import type { ComponentPackage } from "@qflow/component-kit";
import type { StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";
import type { SemanticTake } from "@qflow/speech";

import { speechTrackProducers } from "./manifest.js";
import { appendSpeechTrackTake, assembleSpeechTrack, createSpeechTrackSet } from "./program.js";
import type { SpeechTrackHeader, SpeechTrackSet } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as unknown as T;
}

export const speechTrackComponent = {
  producers: [
    {
      producer: speechTrackProducers.createSet,
      handler: () => ({
        outputs: { set: { kind: "inline", value: canonicalize(createSpeechTrackSet()) } },
        needs: {},
      }),
    },
    {
      producer: speechTrackProducers.appendTake,
      handler: ({ inputs }) => ({
        outputs: { set: { kind: "inline", value: canonicalize(appendSpeechTrackTake(
          inline<SpeechTrackSet>(inputs.set?.value, "SpeechTrackSet"),
          inline<SemanticTake>(inputs.take?.value, "SemanticTake"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: speechTrackProducers.assembleTrack,
      handler: ({ inputs }) => ({
        outputs: { track: { kind: "inline", value: canonicalize(assembleSpeechTrack(
          inline<SpeechTrackHeader>(inputs.header?.value, "SpeechTrackHeader"),
          inline<SpeechTrackSet>(inputs.set?.value, "SpeechTrackSet"),
        )) } },
        needs: {},
      }),
    },
  ],
} satisfies ComponentPackage;
