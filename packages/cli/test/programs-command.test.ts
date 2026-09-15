import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { runCli } from "../src/main.js";
import { commandHint } from "../src/command-hint.js";
import type { CliDistribution } from "../src/distribution.js";
import type { CliManagedProgramProgress, CliManagedProgramReport, CliRuntimeController } from "../src/runtime-port.js";

const io = { write: () => {} };

function controller(
  path: string,
  calls: string[],
  reports: readonly CliManagedProgramReport[] = [],
): CliRuntimeController {
  const worker = { state: "stopped" as const, profile: path, logPath: "/tmp/worker.log" };
  return {
    profile: path,
    dataRoot: "/tmp",
    worker: {
      up: async () => worker,
      status: async () => worker,
      logs: async () => ({ path: worker.logPath, text: "" }),
      down: async () => worker,
    },
    programs: {
      up: async (options) => {
        calls.push(`up ${path} ${JSON.stringify(options)}`);
        return { dataRoot: "/tmp", programs: reports };
      },
      down: async () => { calls.push(`down ${path}`); return { dataRoot: "/tmp", programs: reports }; },
      report: async () => { calls.push(`report ${path}`); return { dataRoot: "/tmp", programs: reports }; },
    },
  };
}

function distribution(calls: string[], reports: readonly CliManagedProgramReport[] = []): CliDistribution {
  return {
    bootstrapPackages: [],
    openRuntimeHost: async (path: string) => ({
      profile: path,
      prepare: async () => [],
      createRuntime: async () => ({ close: async () => {} }),
      controller: async () => controller(path, calls, reports),
    }),
  } as unknown as CliDistribution;
}

test("programs dispatches lifecycle through the selected Runtime Controller", async () => {
  const calls: string[] = [];
  await runCli(["programs", "up", "/p/qflow.runtime.json", "--max-wait-ms", "1000"], io, distribution(calls));
  await runCli(["programs", "down", "/p/qflow.runtime.json"], io, distribution(calls));
  await runCli(["programs", "status", "/p/qflow.runtime.json"], io, distribution(calls));
  // The CLI resolves the profile it is given, and what resolving produces is the platform's own
  // spelling. Asserting the argument back verbatim would only be asserting that this is POSIX.
  const profile = resolve("/p/qflow.runtime.json");
  assert.deepEqual(calls, [
    `up ${profile} {"maxWaitMs":1000}`,
    `down ${profile}`,
    `report ${profile}`,
  ]);
});

test("programs accepts only up, down and status", async () => {
  await assert.rejects(
    runCli(["programs", "restart", "/p/qflow.runtime.json"], io, distribution([])),
    /programs takes up, down or status/u,
  );
});

test("scoped preparation and startup receive the same explicit Endpoint set", async () => {
  const calls: string[] = [];
  let prepared: unknown;
  const selected = distribution(calls);
  const base = selected.openRuntimeHost!;
  await runCli(["programs", "up", "/p/qflow.runtime.json", "--endpoint", "chosen", "--endpoint", "media"], io, {
    ...selected,
    openRuntimeHost: async (...args) => {
      const host = await base(...args);
      return { ...host, prepare: async (scope) => { prepared = scope?.endpoints; return []; } };
    },
  });
  assert.deepEqual(prepared, ["chosen", "media"]);
  assert.match(calls[0]!, /"endpoints":\["chosen","media"\]/u);
});

test("program discovery preserves readiness and failed shutdown names the service still running", async () => {
  const reports: CliManagedProgramReport[] = [
    ...Array.from({ length: 25 }, (_, index) => ({ id: `ready-${index}`, endpoint: "chosen", state: { state: "ready" as const } })),
    { id: "needs-help", endpoint: "other", action: "nothing-to-stop", state: { state: "down", detail: "cannot connect" } },
  ];
  let output = "";
  await runCli(["programs", "status", "/tmp/profile.json", "--json", "--limit", "2"], {
    write(text) { output += text; },
  }, distribution([], reports));
  const parsed = JSON.parse(output);
  assert.equal(parsed.programCount, 26);
  assert.equal(parsed.readyCount, 25);
  assert.deepEqual(parsed.programs.map((item: { id: string }) => item.id), ["needs-help", "ready-0"]);
  assert.equal(parsed.omittedPrograms, 24);

  let failure = "";
  let exitCode = 0;
  await runCli(["programs", "down", "/tmp/profile.json", "--limit", "1"], {
    write(text) { failure += text; }, setExitCode(code) { exitCode = code; },
  }, distribution([], reports));
  assert.equal(exitCode, 1);
  assert.match(failure, /ready-24: ready/u);
  assert.doesNotMatch(failure, /needs-help/u);
});

test("waiting belongs only to programs up", async () => {
  await assert.rejects(
    runCli(["programs", "status", "/p/qflow.runtime.json", "--max-wait-ms", "1000"], io, distribution([])),
    /--max-wait-ms applies to programs up/u,
  );
});

test("program status may report down without failing the observation", async () => {
  let output = "";
  let exitCode: number | undefined;
  await runCli(["programs", "status", "/project/qflow.runtime.json"], {
    write(text) { output += text; },
    setExitCode(code) { exitCode = code; },
  }, distribution([], [{
    id: "speech-evidence.local",
    endpoint: "speech.primary",
    state: { state: "down", detail: "not running" },
  }]));
  assert.equal(exitCode, undefined);
  assert.match(output, /speech-evidence\.local: down/u);
  assert.match(output, /endpoint speech\.primary/u, "expose the selector accepted by --endpoint");
});

test("a declined stop stays visible even when the service is not Ready", async () => {
  const busy: CliManagedProgramReport = {
    id: "preparing", endpoint: "chosen", action: "unchanged",
    state: { state: "down", detail: "not serving yet" },
    detail: "another command owns this Program's preparation or lifecycle change; inspect its logs",
    installationLogPath: "/tmp/install.log",
  };
  for (const json of [false, true]) {
    let output = "";
    let exitCode: number | undefined;
    await runCli(["programs", "down", "/p/profile.json", "--limit", "1", ...(json ? ["--json"] : [])], {
      write(text) { output += text; }, setExitCode(code) { exitCode = code; },
    }, distribution([], [busy]));
    assert.equal(exitCode, 1);
    if (json) {
      const value = JSON.parse(output);
      assert.equal(value.ok, false);
      assert.equal(value.ready, false);
      assert.equal(value.programs[0].installationLogPath, busy.installationLogPath);
    } else {
      assert.match(output, /stop needs attention/u);
      assert.match(output, /another command owns/u);
      assert.doesNotMatch(output, /External programs stopped/u);
    }
  }
  let output = "";
  await runCli(["programs", "down", "/p/profile.json", "--json"], {
    write(text) { output += text; },
  }, distribution([], [{ id: busy.id, endpoint: busy.endpoint, state: busy.state, action: "nothing-to-stop" }]));
  const stopped = JSON.parse(output);
  assert.equal(stopped.ok, true);
  assert.equal(stopped.ready, false, "a successful stop is not service readiness");
});

test("Runtime headlines preserve a running Worker when Programs are down or stop fails", async () => {
  const selected = {
    bootstrapPackages: [],
    openRuntimeHost: async () => ({
      controller: async () => ({
        worker: {
          status: async () => ({ state: "running" }),
          down: async () => ({ state: "running" }),
        },
        programs: { report: async () => ({ programs: [{ id: "loading", endpoint: "chosen", state: { state: "down", detail: "loading" }, pid: 12 }] }) },
      }),
      openControl: async () => ({ activity: async () => ({ builds: [], capacity: [] }), close: async () => {} }),
    }),
  } as unknown as CliDistribution;
  for (const action of ["status", "down"]) {
    let output = "";
    let exitCode: number | undefined;
    await runCli(["runtime", action, "/p/profile.json"], {
      write(text) { output += text; }, setExitCode(code) { exitCode = code; },
    }, selected);
    assert.doesNotMatch(output, /Runtime Worker stopped|Runtime Worker is down/u);
    assert.match(output, action === "status" ? /Programs not ready/u : /Worker is still running/u);
    assert.equal(exitCode, action === "status" ? undefined : 1);
  }
});

test("program startup reports actions, not no-op checks", async () => {
  let output = "";
  const selected = {
    bootstrapPackages: [],
    openRuntimeHost: async (path: string) => ({
      profile: path,
      prepare: async () => [],
      controller: async () => ({
        worker: {},
        programs: {
          async up(options: { readonly onProgress?: (event: { readonly id: string; readonly phase: "checking" | "starting" | "waiting" | "ready"; readonly logPath?: string }) => void }) {
            options.onProgress?.({ id: "example", phase: "checking" });
            options.onProgress?.({ id: "example", phase: "starting", logPath: "/tmp/example/program.log" });
            options.onProgress?.({ id: "example", phase: "waiting" });
            options.onProgress?.({ id: "example", phase: "ready" });
            return { dataRoot: "/tmp", programs: [{ id: "example", endpoint: "example", state: { state: "ready" } }] };
          },
        },
      }),
    }),
  } as unknown as CliDistribution;

  await runCli(["programs", "up", "/project/qflow.runtime.json"], {
    write(text) { output += text; },
  }, selected);

  assert.match(output, /· Starting example/u);
  assert.match(output, /log \/tmp\/example\/program\.log/u);
  assert.match(output, /External programs ready/u);
  assert.doesNotMatch(output, /· (?:Checking|Waiting for|Ready) example/u);
});

test("programs and runtime startup retain failure evidence in human and JSON output", async () => {
  const report: CliManagedProgramReport = {
    id: "local-service",
    endpoint: "selected.local",
    action: "unchanged",
    state: { state: "down", detail: "health endpoint is not answering" },
    detail: "service is still loading",
    pid: 321,
    logPath: "/tmp/local-service/program.log",
    installationLogPath: "/tmp/local-service/install.log",
    errorLogPath: "/tmp/local-service/program.err.log",
  };
  for (const command of ["programs", "runtime"]) {
    for (const json of [false, true]) {
      let output = "";
      let exitCode: number | undefined;
      await runCli([command, "up", "/project/qflow.runtime.json", ...(json ? ["--json"] : [])], {
        write(text) { output += text; },
        setExitCode(code) { exitCode = code; },
      }, distribution([], [report]));
      assert.equal(exitCode, 1);
      if (json) {
        const parsed = JSON.parse(output);
        const item = command === "programs" ? parsed.programs[0] : parsed.programs.items[0];
        assert.equal(item.state, "down");
        assert.equal(item.stateDetail, report.state.state === "ready" ? undefined : report.state.detail);
        assert.equal(item.endpoint, report.endpoint);
        assert.equal(item.detail, report.detail);
        assert.equal(item.logPath, report.logPath);
        assert.equal(item.installationLogPath, report.installationLogPath);
        assert.equal(item.errorLogPath, report.errorLogPath);
        assert.equal(item.pid, report.pid);
      } else {
        assert.match(output, /health endpoint is not answering/u);
        assert.match(output, /service is still loading/u);
        assert.match(output, /PID 321/u);
        assert.match(output, /\/tmp\/local-service\/program\.log/u);
        assert.match(output, /\/tmp\/local-service\/install\.log/u);
        assert.match(output, /\/tmp\/local-service\/program\.err\.log/u);
      }
    }
  }
});

test("JSON startup keeps live preparation evidence on stderr and one result on stdout", async () => {
  let output = "";
  let progress = "";
  const selected = {
    bootstrapPackages: [],
    openRuntimeHost: async () => ({
      prepare: async () => [],
      controller: async () => ({
        programs: {
          async up(options: { onProgress?: (event: CliManagedProgramProgress) => void }) {
            options.onProgress?.({ id: "example", phase: "installing", logPath: "/tmp/install.log", detail: "Prepare sentence data" });
            assert.match(progress, /Prepare sentence data.*\/tmp\/install\.log/u);
            assert.equal(output, "", "no partial JSON or progress text reaches stdout");
            return { dataRoot: "/tmp", programs: [{ id: "example", endpoint: "example", state: { state: "ready" } }] };
          },
        },
      }),
    }),
  } as unknown as CliDistribution;
  await runCli(["programs", "up", "/project/profile.json", "--json"], {
    write(text) { output += text; },
    writeProgress(text) { progress += text; },
  }, selected);
  assert.equal(JSON.parse(output).readyCount, 1);
});

test("runtime up validates the Runtime before it starts Programs", async () => {
  const calls: string[] = [];
  const base = distribution(calls);
  const selected = {
    ...base,
    openRuntimeHost: async (path: string) => ({
      profile: path,
      prepare: async () => [],
      controller: async () => controller(path, calls),
      createRuntime: async () => { throw new Error("Runtime Profile conflict"); },
    }),
  } as unknown as CliDistribution;
  await assert.rejects(
    runCli(["runtime", "up", "/p/qflow.runtime.json"], io, selected),
    /Runtime Profile conflict/u,
  );
  assert.deepEqual(calls, []);
});

test("runtime status keeps scheduling phases out of the default view", async () => {
  let output = "";
  const selected = {
    bootstrapPackages: [],
    openRuntimeHost: async (path: string) => ({
      profile: path,
      controller: async () => ({
        worker: { status: async () => ({ state: "running", profile: path, logPath: "/tmp/worker.log" }) },
        programs: { report: async () => ({
          dataRoot: "/tmp",
          programs: [{ id: "renderer", endpoint: "renderer", state: { state: "ready" } }],
        }) },
      }),
      openControl: async () => ({
        activity: async () => ({ builds: [], capacity: [] }),
        close: async () => {},
      }),
    }),
  } as unknown as CliDistribution;

  await runCli(["runtime", "status", "/project/qflow.runtime.json"], {
    write(text) { output += text; },
  }, selected);

  assert.match(output, /Local Runtime ready/u);
  assert.match(output, /Active Builds\s+0/u);
  assert.doesNotMatch(output, /\bStarting\b|\bWaiting\b|\bDecided\b|Running turn|Capacity in use/u);
});

test("Worker stop suggests Program control in the same project and Profile", async () => {
  const projectRoot = resolve("/tmp");
  const runtimeProfile = resolve("/tmp/a selected profile.json");
  let output = "";
  await runCli(["runtime", "down", "--workspace", projectRoot, "--runtime", runtimeProfile], {
    write(text) { output += text; },
  }, distribution([]));
  assert.ok(output.includes(commandHint(["programs", "down"], { projectRoot, runtimeProfile })));
});
