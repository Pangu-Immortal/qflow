import type { BlobRef } from "@qflow/protocol";

export type BackgroundRemovalRequest = {
  readonly source: BlobRef;
};
