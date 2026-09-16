import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { mediaProcessEnv } from "../src/process-env.js";

test("media processes inherit PATH without the rest of the Host environment", () => {
  const previous = process.env.QFLOW_MEDIA_ENV_PROBE;
  process.env.QFLOW_MEDIA_ENV_PROBE = "secret";
  try {
    const env = mediaProcessEnv();
    assert.equal(env.PATH, process.env.PATH ?? "");
    assert.equal(env.QFLOW_MEDIA_ENV_PROBE, undefined);
    if (process.platform === "win32") {
      if (process.env.SYSTEMROOT !== undefined) assert.equal(env.SYSTEMROOT, process.env.SYSTEMROOT);
      if (process.env.PATHEXT !== undefined) assert.equal(env.PATHEXT, process.env.PATHEXT);
    }
    const report = spawnSync(process.execPath, ["-e", "process.stdout.write(JSON.stringify({ secret: process.env.QFLOW_MEDIA_ENV_PROBE, path: Boolean(process.env.PATH), systemRoot: Boolean(process.env.SYSTEMROOT) }))"], {
      env,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(report.status, 0, report.stderr);
    const body = JSON.parse(report.stdout) as { secret?: string; path: boolean; systemRoot: boolean };
    assert.equal(body.secret, undefined);
    assert.equal(body.path, true);
    if (process.platform === "win32") assert.equal(body.systemRoot, true);
  } finally {
    if (previous === undefined) delete process.env.QFLOW_MEDIA_ENV_PROBE;
    else process.env.QFLOW_MEDIA_ENV_PROBE = previous;
  }
});
