import type { AdmissionPackage } from "@qflow/qflow/admission";
import type { ProducerPackage } from "@qflow/qflow/producer";
import type { Narrative, NarrativeSegmentRef } from "@qflow/qflow/narrative";
import type { StoredValue } from "@qflow/qflow/protocol";
import { canonicalize } from "@qflow/qflow/protocol";
import type { AlignedTranscriptEvidence } from "@qflow/qflow/speech-evidence";
import type { LocalTemporalDomain } from "@qflow/qflow/temporal";

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
} satisfies ProducerPackage & AdmissionPackage;
