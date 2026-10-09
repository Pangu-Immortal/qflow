import { createExactModelPrimaryGenerationFragment } from "@qflow/generation/model";
import type { ExactModelEndpoint, ExactModelMediaInput, ExactModelTextInput } from "@qflow/generation/model";

/** Model result projection over the same graph-native request assembly as every exact model. */
export function createFishAudioSpeechAudioFragment(
  endpoint: ExactModelEndpoint,
  mediaInputs: readonly ExactModelMediaInput[] = [],
  textInputs: readonly ExactModelTextInput[] = [],
) {
  return createExactModelPrimaryGenerationFragment(endpoint, mediaInputs, textInputs);
}
