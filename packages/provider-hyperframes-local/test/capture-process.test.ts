import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { runCaptureProcess } from "../src/capture-process.js";
import { resolveExecutionOptions } from "../src/render.js";
import type { CaptureInput } from "../src/capture.js";
import { browserExecutablePath } from "../src/browser.js";

const exitCleanup = new URL("../src/capture-exit.ts", import.meta.url).href;

test("abrupt engine exit closes its actual Chrome without disturbing another browser", {
  skip: process.env.QFLOW_BROWSER_TESTS !== "1",
}, async () => {
  const { default: puppeteer } = await import("puppeteer-core");
  const chromePath = browserExecutablePath({});
  const other = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox"] });
  const root = await mkdtemp(join(tmpdir(), "qflow-abrupt-chrome-"));
  const pidFile = join(root, "browser");
  let browserPid: number | undefined;
  try {
    const engine = join(root, "engine.mjs");
    await writeFile(engine, `import { acquireBrowser } from ${JSON.stringify(import.meta.resolve("@hyperframes/engine"))};
import { writeFileSync } from 'node:fs';
const { browser } = await acquireBrowser(['--no-sandbox'], {
  chromePath: ${JSON.stringify(chromePath)}, forceScreenshot: true, enableBrowserPool: false,
});
await browser.newPage();
writeFileSync(${JSON.stringify(pidFile)}, String(browser.process().pid));
process.exit(7);`);
    await assert.rejects(runCaptureProcess({
      document: { frameRate: { numerator: 30, denominator: 1 } },
      range: { startFrame: 0, endFrameExclusive: 1 }, config: resolveExecutionOptions({}),
      directory: root, engineModule: pathToFileURL(engine).href,
    } as CaptureInput, new AbortController().signal, () => {}), /exited before completion/u);
    browserPid = Number(await readFile(pidFile, "utf8"));
    try {
      process.kill(browserPid, 0);
      assert.notEqual(process.platform, "win32");
      assert.match(execFileSync("ps", ["-p", String(browserPid), "-o", "stat="], { encoding: "utf8" }).trim(), /^Z/u);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    const page = await other.newPage();
    assert.equal(await page.evaluate(() => 6 * 7), 42);
  } finally {
    browserPid ??= await readFile(pidFile, "utf8").then(Number, () => undefined);
    if (browserPid !== undefined) { try { process.kill(browserPid, "SIGKILL"); } catch {} }
    await other.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("an uncatchable exit cannot hang on an orphan's inherited output pipes", {
  skip: process.platform === "win32", timeout: 15_000,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-capture-killed-"));
  let descendant: number | undefined;
  const diagnostics: string[] = [];
  try {
    const entry = join(root, "worker.mjs");
    await writeFile(entry, `import { spawn } from 'node:child_process';
process.once('message', () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: true, stdio: ['ignore', process.stdout, process.stderr],
  });
  child.unref();
  process.send({ type: 'progress', event: { phase: 'worker-start', browserPid: child.pid } },
    () => process.kill(process.pid, 'SIGKILL'));
});`);
    await assert.rejects(runCaptureProcess({ config: resolveExecutionOptions({}) } as CaptureInput,
      new AbortController().signal, event => {
        if ("browserPid" in event) descendant = event.browserPid;
      }, pathToFileURL(entry), async event => { diagnostics.push(event.message); }), /SIGKILL/u);
    assert.ok(diagnostics.some(message => /descendant cleanup could not be confirmed/u.test(message)));
    assert.ok(diagnostics.some(message => /output pipes did not close/u.test(message)));
  } finally {
    if (descendant !== undefined) { try { process.kill(descendant, "SIGKILL"); } catch {} }
    await rm(root, { recursive: true, force: true });
  }
});

for (const scenario of ["exit-zero", "exit-error", "uncaught", "SIGTERM"] as const) {
  test(`abrupt capture ${scenario} stops detached children before losing their owner`, {
    skip: scenario === "SIGTERM" && process.platform === "win32",
  }, async () => {
    const root = await mkdtemp(join(tmpdir(), "qflow-abrupt-capture-"));
    const pidFile = join(root, "descendant");
    let descendant: number | undefined;
    try {
      const engine = join(root, "engine.mjs");
      const end = scenario === "uncaught" ? "setImmediate(() => { throw new Error('unexpected engine crash'); }); await new Promise(() => {});"
        : scenario === "SIGTERM" ? "process.kill(process.pid, 'SIGTERM'); await new Promise(() => {});"
        : `process.exit(${scenario === "exit-zero" ? 0 : 7});`;
      await writeFile(engine, `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
child.unref();
writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
${end}`);
      await assert.rejects(runCaptureProcess({
        document: { frameRate: { numerator: 30, denominator: 1 } },
        range: { startFrame: 0, endFrameExclusive: 1 }, config: resolveExecutionOptions({}),
        directory: root, engineModule: pathToFileURL(engine).href,
      } as CaptureInput, new AbortController().signal, () => {}), /exited before completion/u);
      descendant = Number(await readFile(pidFile, "utf8"));
      try {
        process.kill(descendant, 0);
        assert.notEqual(process.platform, "win32");
        assert.match(execFileSync("ps", ["-p", String(descendant), "-o", "stat="], { encoding: "utf8" }).trim(), /^Z/u);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    } finally {
      // Also stop this test's child if an assertion fails before its PID is read.
      descendant ??= await readFile(pidFile, "utf8").then(Number, () => undefined);
      if (descendant !== undefined) { try { process.kill(descendant, "SIGKILL"); } catch {} }
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("a capture failure still terminates a detached process left by failed resource cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-worker-failed-cleanup-"));
  let descendant: number | undefined;
  try {
    const engine = join(root, "engine.mjs");
    const pidFile = join(root, "descendant");
    await writeFile(engine, `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
child.unref();
writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
throw new Error('engine initialization failed after starting a child');`);
    await assert.rejects(runCaptureProcess({
      document: { frameRate: { numerator: 30, denominator: 1 } },
      range: { startFrame: 0, endFrameExclusive: 1 }, config: resolveExecutionOptions({}),
      directory: root, engineModule: pathToFileURL(engine).href,
    } as CaptureInput, new AbortController().signal, () => {}), /engine initialization failed/);
    descendant = Number(await readFile(pidFile, "utf8"));
    try {
      process.kill(descendant, 0);
      assert.notEqual(process.platform, "win32");
      assert.match(execFileSync("ps", ["-p", String(descendant), "-o", "stat="], { encoding: "utf8" }).trim(), /^Z/u);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  } finally {
    if (descendant !== undefined) { try { process.kill(descendant, "SIGKILL"); } catch {} }
    await rm(root, { recursive: true, force: true });
  }
});

test("a completed renderer finishes its IPC shutdown and exits naturally", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-render-exit-"));
  try {
    const marker = join(root, "exited");
    const entry = join(root, "worker.mjs");
    await writeFile(entry, `import { releaseCaptureExitCleanup } from ${JSON.stringify(exitCleanup)};
import { writeFileSync } from 'node:fs';
process.on('exit', () => writeFileSync(${JSON.stringify(marker)}, 'natural exit'));
process.once('message', () => {
  releaseCaptureExitCleanup();
  process.send({ type: 'completed' }, () => setTimeout(() => process.disconnect(), 100));
});`);
    await runCaptureProcess({ config: resolveExecutionOptions({}) } as CaptureInput,
      new AbortController().signal, () => {}, pathToFileURL(entry));
    assert.equal(await readFile(marker, "utf8"), "natural exit");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a stuck renderer and its detached child both stop before the call rejects", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-stuck-render-"));
  const controller = new AbortController();
  let descendant: number | undefined;
  try {
    const entry = join(root, "stuck.mjs");
    await writeFile(entry, `import { spawn } from 'node:child_process';
process.once('message', () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
  process.send({ type: 'progress', event: { phase: 'worker-start', browserPid: child.pid } });
});
setInterval(() => {}, 1000);
`);
    await assert.rejects(runCaptureProcess({ config: resolveExecutionOptions({}) } as CaptureInput,
      controller.signal, (event) => {
        if ("browserPid" in event) descendant = event.browserPid;
        controller.abort(new Error("render deadline"));
      }, pathToFileURL(entry)), /render deadline/u);
    assert.ok(descendant !== undefined);
    try {
      process.kill(descendant, 0);
      assert.notEqual(process.platform, "win32");
      assert.match(execFileSync("ps", ["-p", String(descendant), "-o", "stat="], { encoding: "utf8" }).trim(), /^Z/u);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  } finally {
    if (descendant !== undefined) { try { process.kill(descendant, "SIGKILL"); } catch {} }
    await rm(root, { recursive: true, force: true });
  }
});

test("a capture process resolves Distribution packages without workspace links", async () => {
  // A packed Distribution ships its package sources with no node_modules link between them,
  // and the launcher's resolver hooks are process-local. Starting this entry outside the
  // checkout reproduces exactly that: nothing above it declares @qflow/hyperframes.
  const root = await mkdtemp(join(tmpdir(), "qflow-capture-resolution-"));
  const tsx = import.meta.resolve("tsx");
  const bootstrap = new URL("../src/capture-bootstrap.ts", import.meta.url).href;
  try {
    const probe = join(root, "probe.mjs");
    await writeFile(probe, `const module = await import("@qflow/hyperframes/project");
process.stdout.write("resolved:" + Object.keys(module).join(",") + "\\n");`);

    // Control: the preload is the only difference between the two arms below.
    const unresolved = spawnSync(process.execPath, ["--import", tsx, probe], { encoding: "utf8", timeout: 120_000 });
    assert.notEqual(unresolved.status, 0);
    assert.match(unresolved.stderr, /ERR_MODULE_NOT_FOUND/u);

    const resolved = spawnSync(process.execPath, ["--import", tsx, "--import", bootstrap, probe],
      { encoding: "utf8", timeout: 120_000 });
    assert.equal(resolved.status, 0, resolved.stderr);
    assert.match(resolved.stdout, /stageHyperframesProject/u);

    const stale = spawnSync(process.execPath, ["--import", tsx, "--import", bootstrap, probe], {
      encoding: "utf8", timeout: 120_000,
      env: { ...process.env, QFLOW_DISTRIBUTION_ROOT: join(root, "old-installation") },
    });
    assert.equal(stale.status, 0, stale.stderr);
    assert.match(stale.stdout, /stageHyperframesProject/u);

    // The render entry point must actually pass that preload to its child.
    const worker = join(root, "worker.mjs");
    await writeFile(worker, `import { releaseCaptureExitCleanup } from ${JSON.stringify(exitCleanup)};
process.once("message", async () => {
      const module = await import("@qflow/hyperframes/project");
      process.stdout.write("resolved:" + Object.keys(module).join(",") + "\\n");
      releaseCaptureExitCleanup();
      process.send({ type: "completed" }, () => process.disconnect());
    });`);
    const diagnostics: string[] = [];
    await runCaptureProcess({ config: resolveExecutionOptions({}) } as CaptureInput,
      new AbortController().signal, () => {}, pathToFileURL(worker),
      async (message) => { diagnostics.push(message.message); });
    assert.ok(diagnostics.some((message) => message.startsWith("resolved:")), diagnostics.join("\n"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("renderer stdout and stderr diagnostics are drained before reporting success", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-render-diagnostics-"));
  const messages: import("@qflow/runtime").ExecutionDiagnostic[] = [];
  try {
    const entry = join(root, "report.mjs");
    await writeFile(entry, `import { releaseCaptureExitCleanup } from ${JSON.stringify(exitCleanup)};
process.once('message', () => {
      process.stdout.write('browser ready\\n');
      process.stderr.write('render diagnostic\\n');
      releaseCaptureExitCleanup();
      process.send({ type: 'completed' }, () => process.disconnect());
    });`);
    await runCaptureProcess({ config: resolveExecutionOptions({}) } as CaptureInput,
      new AbortController().signal, () => {}, pathToFileURL(entry), async (message) => {
        await new Promise((resolve) => setTimeout(resolve, 5)); messages.push(message);
      });
    assert.ok(messages.some((item) => item.stream === "stdout" && item.message.includes("browser ready")));
    assert.ok(messages.some((item) => item.stream === "stderr" && item.message.includes("render diagnostic")));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("normal exit needs no process enumeration and forced-cleanup failures remain visible", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qflow-render-no-process-tools-"));
  try {
    const runner = join(root, "runner.mjs");
    // Isolate PATH in another Node process: no pgrep/taskkill is available, and other
    // tests retain their normal environment. The capture child uses an absolute Node path.
    await writeFile(runner, `
import { runCaptureProcess } from ${JSON.stringify(new URL("../src/capture-process.ts", import.meta.url).href)};
import { resolveExecutionOptions } from ${JSON.stringify(new URL("../src/render.ts", import.meta.url).href)};
import { pathToFileURL } from 'node:url';
process.env.PATH = ${JSON.stringify(root)};
const diagnostics = [];
const controller = new AbortController();
let error;
try {
  await runCaptureProcess({ config: resolveExecutionOptions({}) }, controller.signal,
    () => controller.abort(new Error('cancel this render')), pathToFileURL(process.argv[2]),
    async (event) => { diagnostics.push(event); });
} catch (caught) { error = caught.message; }
process.stdout.write(JSON.stringify({ error, diagnostics }));
`);
    for (const scenario of ["completed", "failed", "stuck-completed", "cancelled"] as const) {
      await t.test(scenario, async () => {
        const entry = join(root, `${scenario}.mjs`);
        const stuck = scenario === "stuck-completed" || scenario === "cancelled";
        const result = scenario === "failed" ? { type: "failed", error: "capture failed" }
          : scenario === "cancelled" ? { type: "progress", event: { phase: "encoding" } }
          : { type: "completed" };
        await writeFile(entry, `import { releaseCaptureExitCleanup } from ${JSON.stringify(exitCleanup)};
process.once('message', () => {
  ${scenario === 'completed' ? 'releaseCaptureExitCleanup();' : ''}
  process.send(${JSON.stringify(result)}, () => { ${scenario !== "completed" ? "setInterval(() => {}, 1000);" : "process.disconnect();"} });
});`);
        const run = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), runner, entry],
          { encoding: "utf8", timeout: 20_000 });
        assert.equal(run.status, 0, `${run.error ?? ""}\n${run.stderr}`);
        const outcome = JSON.parse(run.stdout) as { error?: string; diagnostics: { level: string; message: string }[] };
        if (scenario === "failed") assert.match(outcome.error!, /capture failed/);
        else if (scenario === "cancelled") assert.match(outcome.error!, /cancel this render/u);
        else assert.equal(outcome.error, undefined);
        if (stuck) {
          assert.ok(outcome.diagnostics.some((d) => d.level === "warning" && /did not exit/u.test(d.message)));
        }
        if (scenario !== "completed") {
          assert.ok(outcome.diagnostics.some((d) => d.level === "warning" && /cleanup could not be confirmed/u.test(d.message)));
        } else assert.deepEqual(outcome.diagnostics, []);
      });
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
