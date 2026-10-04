import type { ComponentPackage } from "@qflow/component-kit";
import type { Narrative, NarrativeSegmentRef } from "@qflow/narrative";
import type { StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";
import type { AlignedTranscriptEvidence } from "@qflow/speech-evidence";
import type { LocalTemporalDomain } from "@qflow/temporal";

import { alignNarrative } from "./local.js";
import { speechAlignmentProducers } from "./manifest.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

export const speechAlignmentComponent = {
  producers: [{
    producer: speechAlignmentProducers.alignNarrative,
    handler: ({ inputs }) => {
      const result = alignNarrative(
        inline<Narrative>(inputs.narrative?.value, "Narrative"),
        inline<NarrativeSegmentRef>(inputs.segment?.value, "NarrativeSegmentRef"),
        inline<LocalTemporalDomain>(inputs.domain?.value, "LocalTemporalDomain"),
        inline<AlignedTranscriptEvidence>(inputs.evidence?.value, "AlignedTranscriptEvidence"),
      );
      return { outputs: {
        alignment: { kind: "inline", value: canonicalize(result) },
      }, needs: {} };
    },
  }],
} satisfies ComponentPackage;
