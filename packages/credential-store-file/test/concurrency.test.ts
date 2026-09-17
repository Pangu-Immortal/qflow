import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { credentialRef } from "@qflow/runtime";
import { FileCredentialStore } from "../src/store.js";

const distribution = fileURLToPath(new URL("../../../", import.meta.url));
const fixture = fileURLToPath(new URL("./store-writer-fixture.ts", import.meta.url));
const writers = 8;

type Exit = { code: number; stderr: string };

/**
 * Place every credential from its own process, released at one shared instant. A Store that keeps
 * every key in one document reads the value it is about to replace, so simultaneous replacements
 * overwrite each other and the last writer's document wins; keeping the schedule spread out instead
 * would let that layout pass, which is why the barrier is the assertion.
 */
async function placeSimultaneously(directory: string, entries: { key: string; secret: string }[]): Promise<Exit[]> {
  const startAt = Date.now() + 3_000;
  return Promise.all(entries.map(({ key, secret }) => new Promise<Exit>((settle) => {
    const writer = spawn(process.execPath, ["--import", "tsx", fixture, directory, key, secret, String(startAt)], {
      cwd: distribution, stdio: ["ignore", "ignore", "pipe"], windowsHide: true,
    });
    let stderr = "";
    writer.stderr.on("data", (chunk) => { stderr += String(chunk); });
    writer.on("close", (code) => settle({ code: code ?? 1, stderr }));
  })));
}

test("processes placing different keys at one instant keep every credential", { timeout: 120_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-file-credentials-process-"));
  try {
    const directory = join(root, "private");
    const entries = Array.from({ length: writers }, (_, index) => ({
      key: `instance-${index}`, secret: `secret-${index}`,
    }));
    const exits = await placeSimultaneously(directory, entries);
    for (const [index, exit] of exits.entries()) {
      assert.equal(exit.code, 0, `writer ${index} failed: ${exit.stderr}`);
    }
    const store = new FileCredentialStore(directory);
    for (const { key, secret } of entries) {
      assert.deepEqual(await store.resolve(credentialRef("file", key)), { secret },
        `${key} was placed by a writer that completed without error, so it must still be readable`);
    }
    assert.deepEqual((await readdir(directory)).sort(), entries.map(({ key }) =>
      `key-${Buffer.from(key, "utf16le").toString("hex")}.json`).sort(),
    "each key owns its own document, with no temporary file left behind");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("two processes placing the same key leave one complete value", { timeout: 120_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "qflow-file-credentials-process-"));
  try {
    const directory = join(root, "private");
    const entries = [{ key: "shared", secret: "first" }, { key: "shared", secret: "second" }];
    const exits = await placeSimultaneously(directory, entries);
    // Separate processes share no order, and Windows refuses to replace a document while another
    // replacement of it is in flight. A writer that loses that contest reports why, and one of them
    // places the credential. Within one process this Store orders the work and both writers place.
    assert.ok(exits.some((exit) => exit.code === 0),
      `no writer placed the credential: ${exits.map((exit) => exit.stderr).join(" ")}`);
    for (const [index, exit] of exits.entries()) {
      if (exit.code !== 0) assert.notEqual(exit.stderr.trim(), "", `writer ${index} failed without saying why`);
    }
    // Which replacement lands last is the filesystem's business; that the value is one writer's
    // whole value, and never a mixture of the two, is this Store's.
    const resolved = await new FileCredentialStore(directory).resolve(credentialRef("file", "shared"));
    assert.ok(["first", "second"].includes(resolved?.secret ?? ""), `expected one complete value, got ${JSON.stringify(resolved)}`);
    assert.equal((await readdir(directory)).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
