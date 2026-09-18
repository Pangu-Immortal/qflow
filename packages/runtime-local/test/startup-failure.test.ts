import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import test from "node:test";
import { defineBuild } from "@qflow/core";
import { FileBuildResultRepository } from "@qflow/build-result";
import { SqliteRuntimeState } from "@qflow/store-sqlite";
import { createGreetingBuild } from "../../core/test/greeting-fixture.js";
import { statePath } from "../src/config.js";
import { superviseBuilds } from "../src/supervisor.js";

const distribution = fileURLToPath(new URL("../../../", import.meta.url));

test("an executor that fails before ready records a failed Build and leaves supervision available", { timeout: 20_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-executor-startup-"));
  const dataRoot = join(root, "runtime");
  const profile = join(root, "profile.json");
  const result = new FileBuildResultRepository(join(root, "results"));
  const state = new SqliteRuntimeState(statePath(dataRoot));
  const abort = new AbortController();
  let supervision: Promise<void> | undefined;
  try {
    const profileValue = { format: "qflow.runtime-local@1", dataRoot, credentials: {}, endpoints: {}, bindings: {} };
    await writeFile(profile, JSON.stringify(profileValue));
    const initial = createGreetingBuild();
    const authored = new Set(initial.program.records.map((record) => record.id));
    const submit = async (build: string): Promise<void> => {
      const request = {
        build,
        componentPackages: [],
        result: { root, selection: { use: "@qflow/build-result-fs", config: { path: "results" } } },
        context: { format: "qflow.local-execution@1", packageRoot: root, hostStateRoot: join(root, "host"),
          distributionPackageRoot: distribution, profile: profileValue },
      };
      await state.submissions.prepare(request);
      await result.create({ id: build, source: { path: "main.svml" }, targets: ["document"],
        publishedOutputs: [{ name: "document", output: "document" }] });
      await state.submissions.commit({ ...request,
        definition: defineBuild({ program: initial.program,
          initialRecords: initial.records.filter((record) => !authored.has(record.id)),
          plan: initial.plan, targets: initial.targets }),
        catalog: { source: { path: join(root, "main.svml") },
          publishedOutputs: [{ name: "document", ref: { kind: "logical-output", id: "document" } }] },
      });
    };
    const failed = async (build: string) => {
      const deadline = Date.now() + 10_000;
      let recorded = await result.read(build);
      while (recorded?.outcome === undefined && Date.now() < deadline) {
        await pause(25);
        recorded = await result.read(build);
      }
      assert.equal(recorded?.outcome, "failed");
      assert.match(recorded.failure ?? "", /executor startup failed/u);
    };
    await submit("bld_20260919T120000000Z_0000000001");
    supervision = superviseBuilds({ profile, dataRoot, readyFile: join(root, "ready"), owner: "startup-test",
      launch: { command: process.execPath, args: ["--eval", "process.exit(3)"] },
      signal: abort.signal, ready: async () => {} });
    await failed("bld_20260919T120000000Z_0000000001");
    await submit("bld_20260919T120000001Z_0000000001");
    await failed("bld_20260919T120000001Z_0000000001");
    assert.deepEqual(await state.execution.listUnstarted(), []);
    assert.deepEqual(await state.execution.listCapacity(), []);
  } finally {
    abort.abort();
    await supervision;
    state.close();
    await rm(root, { recursive: true, force: true });
  }
});
