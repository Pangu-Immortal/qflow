import type { ComponentPackage } from "@qflow/component-kit";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import type { NarrativeAlignment } from "@qflow/narrative-temporal";
import type { LocalTemporalDomain } from "@qflow/temporal";

import { narrativeAlignmentAdjustProducers } from "./manifest.js";
import { adjustNarrativeAlignment } from "./program.js";
import type { NarrativeAlignmentAdjustmentPlan } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline.`);
  return value.value as unknown as T;
}

export const narrativeAlignmentAdjustComponent = {
  producers: [{
    producer: narrativeAlignmentAdjustProducers.adjust,
    handler: ({ inputs }) => ({
      outputs: {
        alignment: {
          kind: "inline",
          value: canonicalize(adjustNarrativeAlignment(
            inline<NarrativeAlignment>(inputs.source?.value, "NarrativeAlignment"),
            inline<LocalTemporalDomain>(inputs.domain?.value, "LocalTemporalDomain"),
            inline<NarrativeAlignmentAdjustmentPlan>(inputs.plan?.value, "NarrativeAlignment adjustment plan"),
          )),
        },
      },
      needs: {},
    }),
  }],
} satisfies ComponentPackage;
