import type { ComponentPackage } from "@qflow/component-kit";
import type { StoredValue } from "@qflow/protocol";

import {
  assertAlignedTranscriptEvidenceIdentity,
  assertSpeechEvidenceAudioIdentity,
  speechEvidenceTypes,
} from "./index.js";
import type { AlignedTranscriptEvidence, SpeechEvidenceAudio } from "./index.js";

function inline<T>(value: StoredValue, subject: string): T {
  if (value.kind !== "inline") throw new Error(`${subject} must be inline.`);
  return value.value as T;
}

export const speechEvidenceComponent = {
  validators: [
    { type: speechEvidenceTypes.audio,
      handler: ({ value }) => assertSpeechEvidenceAudioIdentity(inline<SpeechEvidenceAudio>(value, "SpeechEvidenceAudio")) },
    { type: speechEvidenceTypes.alignedTranscript,
      handler: ({ value }) => assertAlignedTranscriptEvidenceIdentity(inline<AlignedTranscriptEvidence>(value, "AlignedTranscriptEvidence")) },
  ],
} satisfies ComponentPackage;
