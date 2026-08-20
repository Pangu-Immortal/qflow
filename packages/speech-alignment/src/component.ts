import type { ComponentPackage } from "@qflow/component-kit";
import type { SynchronizedMedia } from "@qflow/media";
import type { Narrative, NarrativeExcerpt } from "@qflow/narrative";
import type { AlignedTranscriptEvidence } from "@qflow/speech-evidence";
import type { StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";

import { alignSemanticTake } from "./local.js";
import { speechAlignmentProducers } from "./manifest.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

/** Provider-neutral deterministic alignment; acoustic measurement remains an explicit upstream Need. */
export const speechAlignmentComponent = {
  producers: [
    {
      producer: speechAlignmentProducers.alignTake,
      handler: ({ inputs }) => ({
        outputs: {
          take: {
            kind: "inline",
            value: canonicalize(alignSemanticTake(
              inline<Narrative>(inputs.narrative?.value, "Narrative"),
              inline<NarrativeExcerpt>(inputs.segment?.value, "NarrativeExcerpt"),
              inline<SynchronizedMedia>(inputs.media?.value, "SynchronizedMedia"),
              inline<AlignedTranscriptEvidence>(inputs.evidence?.value, "AlignedTranscriptEvidence"),
            )),
          },
        },
        needs: {},
      }),
    },
  ],
} satisfies ComponentPackage;
