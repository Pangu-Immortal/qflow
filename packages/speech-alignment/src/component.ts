import type { ComponentPackage } from "@qflow/component-kit";
import type { Narrative } from "@qflow/narrative";
import type { SpeechAudioBasis } from "@qflow/speech";
import type { AlignedTranscriptEvidence } from "@qflow/speech-evidence";
import type { StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";

import {
  locateSpeechTiming,
} from "./locate.js";
import { speechAlignmentProducers } from "./manifest.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

/** Provider-neutral deterministic alignment; acoustic measurement remains an explicit upstream Need. */
export const speechAlignmentComponent = {
  producers: [{
    producer: speechAlignmentProducers.locate,
    handler: ({ inputs }) => ({
      outputs: {
        map: {
          kind: "inline",
          value: canonicalize(locateSpeechTiming(
            inline<Narrative>(inputs.narrative?.value, "Narrative"),
            inline<SpeechAudioBasis>(inputs.audio?.value, "SpeechAudioBasis"),
            inline<AlignedTranscriptEvidence>(inputs.evidence?.value, "AlignedTranscriptEvidence"),
          )),
        },
      },
      needs: {},
    }),
  }],
} satisfies ComponentPackage;
