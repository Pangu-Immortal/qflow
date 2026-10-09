import { blobTypes } from "@qflow/qflow/blob";
import { sealGraphFragment } from "@qflow/qflow/author";
import { generationProducers } from "@qflow/generation";
import { createExactModelPrimaryGenerationFragment } from "@qflow/generation/model";
import type { ExactModelEndpoint, ExactModelMediaInput, ExactModelTextInput } from "@qflow/generation/model";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

/**
 * Keep the remote GeneratedVideoSet atomic, then deterministically expose its
 * primary video as an ordinary Blob for downstream media programs.
 */
export function createSeedanceGenerationFragment(endpoint: ExactModelEndpoint) {
  return sealGraphFragment({
    inputs: [{ name: "request", type: endpoint.requestType }],
    operations: [
      {
        id: "generate",
        producer: endpoint.producer,
        inputs: { request: input("request") },
        result: { kind: "need", name: "generation" },
      },
      {
        id: "select-primary-video",
        producer: generationProducers.primaryVideo,
        inputs: { set: operation("generate") },
        result: { kind: "output", name: "video" },
      },
    ],
    exports: [{
      name: "video",
      type: blobTypes.blob,
      root: operation("select-primary-video"),
    }],
  });
}

/** Request assembly used by author Surfaces whose media references may be runtime outputs. */
export function createSeedanceAssembledGenerationFragment(
  endpoint: ExactModelEndpoint,
  mediaInputs: readonly ExactModelMediaInput[] = [],
  textInputs: readonly ExactModelTextInput[] = [],
) {
  return createExactModelPrimaryGenerationFragment(endpoint, mediaInputs, textInputs);
}
