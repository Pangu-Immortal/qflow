import type {
  Awaitable,
  SourceAssetResolver,
  SourceResolver,
  ResolvedSource,
} from "@qflow/source";
import type { BlobRef } from "@qflow/protocol";

/** Repeatably openable transfer bytes admitted by the selected Workspace. */
export type BlobAttachment = {
  readonly artifact: BlobRef;
  /** Stable external address, when the Workspace supplies a file by reference. */
  readonly location?: string;
  open(): Awaitable<AsyncIterable<Uint8Array>>;
};

/** One isolated, read-once definition session for exactly one compilation. */
export interface WorkspaceSession {
  readonly entry: ResolvedSource;
  readonly resolveSource: SourceResolver;
  readonly resolveAsset: SourceAssetResolver;
  attachments(): Awaitable<readonly BlobAttachment[]>;
}

/** Replaceable definition environment: filesystem, browser, Git, memory or remote workspace. */
export interface Workspace {
  open(entryLocator: string): Awaitable<WorkspaceSession>;
}

export class WorkspaceError extends Error {
  readonly code: string;
  readonly subject: string | undefined;

  constructor(code: string, message: string, subject?: string) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
    this.subject = subject;
  }
}
