import type { ComponentPackage } from "@qflow/component-kit";
import type { SpeechEstimatePolicy } from "@qflow/estimate";
import type { SynchronizedMedia } from "@qflow/media";
import type { Narrative, NarrativeExcerpt } from "@qflow/narrative";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";

import { semanticTakeEstimateProducers } from "./manifest.js";
import { materializeEstimatedSemanticTake } from "./program.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as unknown as T;
}

export const semanticTakeEstimateComponent = {
  producers: [{
    producer: semanticTakeEstimateProducers.materialize,
    handler: ({ inputs }) => ({
      outputs: {
        take: {
          kind: "inline",
          value: canonicalize(materializeEstimatedSemanticTake(
            inline<Narrative>(inputs.narrative?.value, "Narrative"),
            inline<NarrativeExcerpt>(inputs.segment?.value, "NarrativeExcerpt"),
            inline<SynchronizedMedia>(inputs.media?.value, "SynchronizedMedia"),
            inline<SpeechEstimatePolicy>(inputs.policy?.value, "SpeechEstimatePolicy"),
          )),
        },
      },
      needs: {},
    }),
  }],
} satisfies ComponentPackage;
