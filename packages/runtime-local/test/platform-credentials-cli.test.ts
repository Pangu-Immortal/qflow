import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);
const launcher = fileURLToPath(new URL("../../../bin/qflow.mjs", import.meta.url));

/**
 * The examples select the `platform` Store so one committed Profile works on Linux, macOS and Windows.
 * On macOS and Windows it would use the real keychain or Credential Locker of whoever runs the
 * suite, so this test covers Linux and skips other platforms.
 */
const isLinux = process.platform === "linux";

test("the interview example authenticates on Linux, without editing its Profile",
  { skip: !isLinux, timeout: 120_000 }, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "qflow-platform-example-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const project = join(root, "project");
    const state = join(root, "host");
    await mkdir(project, { recursive: true });
    const profile = fileURLToPath(new URL("../../../examples/interview/qflow.runtime.json", import.meta.url));
    const run = (...args: string[]) => exec(process.execPath, [launcher, ...args, "--json"], {
      cwd: project, env: { ...process.env, QFLOW_STATE_HOME: state }, timeout: 60_000, windowsHide: true,
    });
    const auth = (action: string, ...args: string[]) =>
      run("auth", action, "qflowhub.default", "--runtime", profile, ...args);

    const before = JSON.parse((await auth("status")).stdout).credentials[0];
    assert.equal(before.configured, false, "the committed Profile opens, so nothing here rewrites it");
    assert.equal(before.writable, true, "the Linux policy accepts a credential");
    const input = join(root, "secret.txt");
    await writeFile(input, "example-secret-never-displayed");
    const login = await auth("login", "--from", input);
    assert.doesNotMatch(login.stdout, /example-secret-never-displayed/u);
    assert.equal(JSON.parse((await auth("status")).stdout).credentials[0].configured, true);

    // Linux uses the file Store's own directory, so switching Stores there finds it.
    assert.equal((await readdir(join(state, "credentials"))).length, 1);

    await auth("logout");
    assert.equal(JSON.parse((await auth("status")).stdout).credentials[0].configured, false);
    assert.deepEqual(await readdir(join(state, "credentials")), []);
  });

test("the Profile runtime init writes authenticates on Linux, without editing it",
  { skip: !isLinux, timeout: 120_000 }, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "qflow-platform-init-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const project = join(root, "project");
    const state = join(root, "host");
    await mkdir(project, { recursive: true });
    const run = (...args: string[]) => exec(process.execPath, [launcher, ...args, "--json"], {
      cwd: project, env: { ...process.env, QFLOW_STATE_HOME: state }, timeout: 60_000, windowsHide: true,
    });
    await run("runtime", "init");
    const starter = JSON.parse(await readFile(join(project, "qflow.runtime.json"), "utf8"));
    assert.deepEqual(starter.credentials, { local: { use: "@qflow/credential-store-local" } },
      "a starter that selects a Store Linux cannot open fails every command that follows");

    // Everything below resolves the Profile the starter just wrote and selected, with no flags.
    const status = async () => JSON.parse((await run("auth", "status", "qflowhub.default")).stdout).credentials[0];
    assert.equal((await status()).configured, false);
    assert.equal((await status()).writable, true);
    const input = join(root, "secret.txt");
    await writeFile(input, "starter-secret-never-displayed");
    const login = await run("auth", "login", "qflowhub.default", "--from", input);
    assert.doesNotMatch(login.stdout, /starter-secret-never-displayed/u);
    assert.equal((await status()).configured, true);
    assert.equal((await readdir(join(state, "credentials"))).length, 1);
    await run("auth", "logout", "qflowhub.default");
    assert.equal((await status()).configured, false);
    assert.deepEqual(await readdir(join(state, "credentials")), []);
  });
