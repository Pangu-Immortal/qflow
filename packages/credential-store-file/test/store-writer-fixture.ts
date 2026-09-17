import { once } from "node:events";
import { credentialRef } from "@qflow/runtime";
import { FileCredentialStore } from "../src/store.js";

const [directory, key, secret] = process.argv.slice(2);

async function place(): Promise<void> {
  const store = new FileCredentialStore(directory!);
  const release = once(process, "message");
  process.send!({ ready: true });
  await release;
  await store.put(credentialRef("file", key!), { secret: secret! });
  process.disconnect();
}

place().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
