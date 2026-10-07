import assert from "node:assert/strict";
import { chmod, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { credentialRef } from "@qflow/runtime";
import { FileCredentialStore } from "../src/file.js";

test("independent credential keys retain concurrent writes and round-trip opaque names", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-file-credentials-"));
  try {
    const directory = join(root, "private");
    const store = new FileCredentialStore(directory);
    const keys = ["Account", "account", "../outside", "密钥/one", "CON", "\ud800", "\ufffd"];
    assert.equal(await store.resolve(credentialRef("file", "missing")), undefined);
    const writers = keys.map(() => new FileCredentialStore(directory));
    await Promise.all(keys.map((key, index) => writers[index]!.put(credentialRef("file", key), {
      secret: `secret-${index}`, expiresAt: 12345,
    })));
    for (const [index, key] of keys.entries()) {
      assert.deepEqual(await store.resolve(credentialRef("file", key)), { secret: `secret-${index}`, expiresAt: 12345 });
    }
    assert.deepEqual(await readdir(root), ["private"]);
    const files = await readdir(directory);
    assert.equal(files.length, keys.length);
    for (const name of files) {
      assert.deepEqual(Object.keys(JSON.parse(await readFile(join(directory, name), "utf8"))).sort(), ["expiresAt", "secret"]);
      if (process.platform !== "win32") assert.equal((await stat(join(directory, name))).mode & 0o777, 0o600);
    }
    assert.equal(await store.resolve(credentialRef("env", "Account")), undefined);
    assert.equal(await store.delete(credentialRef("file", keys[0]!)), true);
    assert.equal(await store.delete(credentialRef("file", keys[0]!)), false);
    assert.deepEqual(await store.resolve(credentialRef("file", keys[1]!)), { secret: "secret-1", expiresAt: 12345 });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("corrupt values report no secret bytes and can be replaced or deleted without reading", async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-file-credentials-"));
  try {
    const store = new FileCredentialStore(root);
    const ref = credentialRef("file", "service");
    await store.put(ref, { secret: "original" });
    const path = join(root, (await readdir(root))[0]!);
    await writeFile(path, 'private-secret-not-json');
    await assert.rejects(store.resolve(ref), error => {
      assert.match(String(error), /Cannot decode credential file/u);
      assert.doesNotMatch(String(error), /private-secret/u);
      return true;
    });
    await store.put(ref, { secret: "replacement" });
    assert.deepEqual(await store.resolve(ref), { secret: "replacement" });
    await writeFile(path, '{"secret":false}');
    assert.equal(await store.delete(ref), true);
    assert.equal(await store.resolve(ref), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("file credentials require an owner-private directory on POSIX", { skip: process.platform === "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-file-credentials-"));
  try {
    await chmod(root, 0o755);
    const store = new FileCredentialStore(root);
    await assert.rejects(store.put(credentialRef("file", "service"), { secret: "secret" }), /owner-private/u);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
