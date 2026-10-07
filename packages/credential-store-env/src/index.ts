import type {
  CredentialRef,
  CredentialStore,
  CredentialValue,
} from "@qflow/runtime-local/extension";
import { verifyCredentialRef } from "@qflow/runtime-local/extension";

/** Resolves only explicitly requested environment variables and never snapshots or enumerates env. */
export class EnvironmentCredentialStore implements CredentialStore {
  readonly #environment: NodeJS.ProcessEnv;

  constructor(environment: NodeJS.ProcessEnv = process.env) {
    this.#environment = environment;
  }

  async resolve(ref: CredentialRef): Promise<CredentialValue | undefined> {
    verifyCredentialRef(ref);
    if (ref.store !== "env") return undefined;
    const secret = this.#environment[ref.key];
    if (secret === undefined || secret.length === 0) return undefined;
    return { secret };
  }
}
