import { credentialRef } from "@qflow/runtime";
import { FileCredentialStore } from "../src/store.js";

const [directory, key, secret, startAt] = process.argv.slice(2);

// The parent releases every writer at the same wall-clock instant, because the failure this guards
// against is a shared document read, modified and replaced: it survives sequential writes and a
// spread-out schedule, and only loses a key when two replacements overlap.
async function place(): Promise<void> {
  const store = new FileCredentialStore(directory!);
  while (Date.now() < Number(startAt)) await new Promise((done) => setTimeout(done, 0));
  await store.put(credentialRef("file", key!), { secret: secret! });
}

place().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
