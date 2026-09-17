import assert from "node:assert/strict";
import childProcess from "node:child_process";
import type { ExecFileOptionsWithStringEncoding } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import { probeMediaToolchain } from "../src/toolchain.js";

test("tool availability uses the execution environment without assuming a task's codec requirements", async t => {
  const original = childProcess.execFile;
  const calls: string[][] = [];
  const launch = t.mock.method(childProcess, "execFile", (
    command: string, args: readonly string[], options: ExecFileOptionsWithStringEncoding,
    callback: (error: childProcess.ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    calls.push([command, ...args]);
    return original(process.execPath, ["-e", 'process.stdout.write(process.env.SELECTED_TOOL_ENV || "")'], options, callback);
  });
  syncBuiltinESMExports();
  try {
    assert.deepEqual(await probeMediaToolchain({ ffprobePath: "chosen-probe", ffmpegPath: "chosen-encoder",
      environment: { SELECTED_TOOL_ENV: "selected tool version" },
    }), { state: "ready", ffprobeVersion: "selected tool version", ffmpegVersion: "selected tool version" });
    assert.deepEqual(calls, [["chosen-probe", "-version"], ["chosen-encoder", "-version"]]);
    assert.equal((await probeMediaToolchain({ ffprobePath: "chosen-probe", environment: {} })).state, "mismatch");
  } finally { launch.mock.restore(); syncBuiltinESMExports(); }
});
