import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);
const launcher = fileURLToPath(new URL("../../../bin/qflow.mjs", import.meta.url));

test("an explicitly selected file Store supports CLI login, repair and logout without starting execution", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qflow-cli-file-credentials-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const state = join(root, "host");
  const run = (...args: string[]) => exec(process.execPath, [launcher, ...args, "--json"], {
    cwd: root, env: { ...process.env, QFLOW_STATE_HOME: state }, timeout: 30_000, windowsHide: true,
  });
  await run("runtime", "init", "--workspace", root);
  const profilePath = join(root, "qflow.runtime.json");
  const profile = JSON.parse(await readFile(profilePath, "utf8"));
  assert.equal(profile.credentials.platform.use, "@qflow/credential-store-platform", "initialization preserves the existing starter choice");
  const directory = join(root, "chosen-credentials");
  profile.credentials = { file: { use: "@qflow/credential-store-file", config: { path: directory } } };
  profile.endpoints = { "qflowhub.default": { ...profile.endpoints["qflowhub.default"], config: {
    ...profile.endpoints["qflowhub.default"].config,
    apiKey: { store: "file", key: "test.oauth" },
  } } };
  await writeFile(profilePath, JSON.stringify(profile));
  const auth = (action: string, ...args: string[]) => run("auth", action, "qflowhub.default", "--runtime", profilePath, ...args);
  assert.equal(JSON.parse((await auth("status")).stdout).credentials[0].configured, false);
  const input = join(root, "input.txt");
  await writeFile(input, "test-secret-never-display");
  await auth("login", "--from", input);
  const status = (await auth("status")).stdout;
  assert.equal(JSON.parse(status).credentials[0].configured, true);
  assert.doesNotMatch(status, /test-secret-never-display/u);
  const path = join(directory, (await readdir(directory))[0]!);
  await writeFile(path, "corrupt-secret-never-display");
  await assert.rejects(auth("status"), error => {
    const output = String((error as { stdout?: string }).stdout);
    assert.match(JSON.parse(output).error.message, /Cannot decode credential file/u);
    assert.doesNotMatch(output, /corrupt-secret-never-display/u);
    return true;
  });
  await auth("login", "--from", input);
  assert.equal(JSON.parse((await auth("status")).stdout).credentials[0].configured, true);
  await writeFile(path, "corrupt-again");
  await auth("logout");
  assert.equal(JSON.parse((await auth("status")).stdout).credentials[0].configured, false);
  assert.deepEqual(await readdir(directory), []);
});
