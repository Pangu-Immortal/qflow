import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { credentialRef } from "@qflow/runtime";
import { FileCredentialStore } from "@qflow/credential-store-file";
import { OsCredentialStore } from "@qflow/credential-store-os";
import { PlatformCredentialStore } from "@qflow/credential-store-platform";

/** A locker that keeps entries in memory, so a platform's locker is exercised without touching one. */
function memoryLocker(entries: Readonly<Record<string, string>> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    read: async (_service: string, account: string) => values.get(account),
    write: async (_service: string, account: string, secret: string) => { values.set(account, secret); },
    remove: async (_service: string, account: string) => values.delete(account),
    entries: values,
  };
}

async function scratch(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix));
}

test("a platform with a locker stores there and never creates a file", async () => {
  const root = await scratch("qflow-platform-credentials-");
  try {
    const directory = join(root, "credentials");
    const locker = memoryLocker();
    const store = new PlatformCredentialStore({ directory, platform: "darwin", locker });
    const ref = credentialRef("platform", "qflowhub.oauth");
    assert.equal(await store.resolve(ref), undefined);
    await store.put(ref, { secret: "locker-secret" });
    assert.deepEqual(await store.resolve(ref), { secret: "locker-secret" });
    assert.equal(locker.entries.get("qflowhub.oauth"), "locker-secret");
    assert.equal(await store.delete(ref), true);
    assert.equal(await store.resolve(ref), undefined);
    assert.deepEqual(await readdir(root), [], "the file fallback stays untouched where a locker exists");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Windows selects the locker as well", async () => {
  const root = await scratch("qflow-platform-credentials-");
  try {
    const locker = memoryLocker();
    const store = new PlatformCredentialStore({
      directory: join(root, "credentials"), platform: "win32", locker,
    });
    await store.put(credentialRef("platform", "qflowhub.oauth"), { secret: "locker-secret" });
    assert.equal(locker.entries.get("qflowhub.oauth"), "locker-secret");
    assert.deepEqual(await readdir(root), [], "the file fallback stays untouched where a locker exists");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a platform without a locker stores owner-private documents in the file Store's directory", async () => {
  const root = await scratch("qflow-platform-credentials-");
  try {
    const directory = join(root, "credentials");
    const store = new PlatformCredentialStore({ directory, platform: "linux" });
    const ref = credentialRef("platform", "qflowhub.oauth");
    await store.put(ref, { secret: "file-secret", expiresAt: 42 });
    assert.deepEqual(await store.resolve(ref), { secret: "file-secret", expiresAt: 42 });
    const files = await readdir(directory);
    assert.deepEqual(files, [`key-${Buffer.from("qflowhub.oauth", "utf16le").toString("hex")}.json`]);
    if (process.platform !== "win32") {
      assert.equal((await stat(join(directory, files[0]!))).mode & 0o777, 0o600);
    }
    assert.equal(await store.delete(ref), true);
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("switching between this Store and the file Store finds the same credential", async () => {
  const root = await scratch("qflow-platform-credentials-");
  try {
    const directory = join(root, "credentials");
    await new FileCredentialStore(directory).put(credentialRef("file", "qflowhub.oauth"), { secret: "written-by-file" });
    const platform = new PlatformCredentialStore({ directory, platform: "linux" });
    assert.deepEqual(await platform.resolve(credentialRef("platform", "qflowhub.oauth")), { secret: "written-by-file" });
    await platform.put(credentialRef("platform", "second"), { secret: "written-by-platform" });
    assert.deepEqual(await new FileCredentialStore(directory).resolve(credentialRef("file", "second")),
      { secret: "written-by-platform" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("only this Store owns the name platform, and it owns no other name", async () => {
  const root = await scratch("qflow-platform-credentials-");
  try {
    const directory = join(root, "credentials");
    const platform = new PlatformCredentialStore({ directory, platform: "linux" });
    const ref = credentialRef("platform", "qflowhub.oauth");
    assert.equal(await platform.resolve(credentialRef("file", "qflowhub.oauth")), undefined,
      "a ref filed under another name is not this Store's to answer");
    await assert.rejects(platform.put(credentialRef("env", "QFLOWHUB_OAUTH"), { secret: "x" }), /does not own env/u);
    await assert.rejects(platform.delete(credentialRef("os", "qflowhub.oauth")), /does not own os/u);
    assert.equal(new FileCredentialStore(directory).owns(ref), false);
    assert.equal(new OsCredentialStore(memoryLocker()).owns(ref), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
