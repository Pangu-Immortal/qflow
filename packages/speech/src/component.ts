import type { ComponentPackage } from "@qflow/component-kit";
import type { SynchronizedMedia } from "@qflow/media";
import type { Narrative, NarrativeExcerpt } from "@qflow/narrative";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";

import {
  assertSemanticTakeIdentity,
  assertSpeechDurationIdentity,
  assertSpeechEvidenceAudioIdentity,
} from "./identity.js";
import { materializeSegmentBoundaryTake } from "./materialize.js";
import { speechProducers, speechTypes } from "./manifest.js";
import type { SemanticTake, SpeechDuration, SpeechEvidenceAudio } from "./types.js";

function inline<T>(value: StoredValue, subject: string): T {
  if (value.kind !== "inline") throw new Error(`${subject} must be inline.`);
  return value.value as T;
}

export const speechComponent = {
  validators: [
    { type: speechTypes.duration, handler: ({ value }) => assertSpeechDurationIdentity(inline<SpeechDuration>(value, "SpeechDuration")) },
    { type: speechTypes.evidenceAudio, handler: ({ value }) => assertSpeechEvidenceAudioIdentity(inline<SpeechEvidenceAudio>(value, "SpeechEvidenceAudio")) },
    { type: speechTypes.semanticTake, handler: ({ value }) => assertSemanticTakeIdentity(inline<SemanticTake>(value, "SemanticTake")) },
  ],
  producers: [{
    producer: speechProducers.materializeSegmentBoundaries,
    handler: ({ inputs }) => ({
      outputs: {
        take: {
          kind: "inline",
          value: canonicalize(materializeSegmentBoundaryTake(
            inline<Narrative>(inputs.narrative!.value, "Narrative"),
            inline<NarrativeExcerpt>(inputs.segment!.value, "NarrativeExcerpt"),
            inline<SynchronizedMedia>(inputs.media!.value, "SynchronizedMedia"),
          )),
        },
      },
      needs: {},
    }),
  }],
} satisfies ComponentPackage;
