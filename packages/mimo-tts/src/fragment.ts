import { createExactModelPrimaryGenerationFragment } from "@qflow/model-kit";
import type { ExactModelEndpoint, ExactModelMediaInput, ExactModelTextInput } from "@qflow/model-kit";

/** Model result projection over the same graph-native request assembly as every exact model. */
export function createMimoTtsAudioFragment(
  endpoint: ExactModelEndpoint,
  mediaInputs: readonly ExactModelMediaInput[] = [],
  textInputs: readonly ExactModelTextInput[] = [],
) {
  return createExactModelPrimaryGenerationFragment(endpoint, mediaInputs, textInputs);
}
