import {
  credentialRef,
  verifyCredentialRef,
} from "@qflow/runtime";
import type {
  CredentialRef,
  CredentialValue,
  WritableCredentialStore,
} from "@qflow/runtime";
import { FileCredentialStore } from "@qflow/credential-store-file";
import { OsCredentialStore } from "@qflow/credential-store-os";
import type {
  OsCredentialDeleter,
  OsCredentialReader,
  OsCredentialWriter,
} from "@qflow/credential-store-os";

export type PlatformCredentialStoreOptions = {
  /** Directory holding the documents this Store selects on Linux. */
  readonly directory: string;
  /** Service the locker's entries are filed under; the OS Store's own default applies where absent. */
  readonly service?: string;
  /**
   * The platform to select for, defaulting to the running one. A Profile never states this: it is
   * separate so the selection can be exercised on one machine for every platform.
   */
  readonly platform?: NodeJS.Platform;
  /** Locker backend to read and write with, where the platform's own locker is not the one to use. */
  readonly locker?: {
    readonly read: OsCredentialReader;
    readonly write: OsCredentialWriter;
    readonly remove: OsCredentialDeleter;
  };
};

/**
 * An explicitly selected storage policy: OS credentials on macOS/Windows, files on Linux.
 * The selected backend's errors propagate; other platforms are unsupported by this package.
 */
export class PlatformCredentialStore implements WritableCredentialStore {
  readonly #delegate: WritableCredentialStore;
  readonly #backing: "os" | "file";

  constructor(options: PlatformCredentialStoreOptions) {
    const platform = options.platform ?? process.platform;
    if (platform === "darwin" || platform === "win32") {
      this.#backing = "os";
      this.#delegate = new OsCredentialStore({
        ...(options.service === undefined ? {} : { service: options.service }),
        ...options.locker,
      });
    } else if (platform === "linux") {
      this.#backing = "file";
      this.#delegate = new FileCredentialStore(options.directory);
    } else {
      throw new Error(`Platform CredentialStore does not support ${platform}; select an explicit CredentialStore supported by this host`);
    }
  }

  owns(ref: CredentialRef): boolean {
    return ref.store === "platform";
  }

  /**
   * Each delegate owns its own name and refuses refs filed under another, so a ref this Store owns
   * is retargeted before the delegate sees it. Only the name changes; the opaque key is untouched.
   */
  #translated(ref: CredentialRef): CredentialRef {
    return credentialRef(this.#backing, ref.key);
  }

  async resolve(ref: CredentialRef): Promise<CredentialValue | undefined> {
    verifyCredentialRef(ref);
    if (!this.owns(ref)) return undefined;
    return await this.#delegate.resolve(this.#translated(ref));
  }

  async put(ref: CredentialRef, value: CredentialValue): Promise<void> {
    verifyCredentialRef(ref);
    if (!this.owns(ref)) throw new Error(`Platform CredentialStore does not own ${ref.store}`);
    await this.#delegate.put(this.#translated(ref), value);
  }

  async delete(ref: CredentialRef): Promise<boolean> {
    verifyCredentialRef(ref);
    if (!this.owns(ref)) throw new Error(`Platform CredentialStore does not own ${ref.store}`);
    return await this.#delegate.delete(this.#translated(ref));
  }
}
