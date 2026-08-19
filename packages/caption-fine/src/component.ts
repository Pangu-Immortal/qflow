import type { CaptionProgram, TimedCaptionProjection } from "@qflow/caption";
import type { ComponentPackage } from "@qflow/component-kit";
import type { CaptionDisplaySequence } from "@qflow/narrative";
import type { ProgramSpace } from "@qflow/program-space";
import type { StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";

import { captionFineProducers } from "./manifest.js";
import { renderFineCaption } from "./render.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

export const captionFineComponent = {
  producers: [{
    producer: captionFineProducers.render,
    handler: ({ inputs }) => ({
      outputs: { track: { kind: "inline", value: canonicalize(renderFineCaption(
        inline<TimedCaptionProjection>(inputs.caption?.value, "TimedCaptionProjection"),
        inline<CaptionProgram>(inputs.program?.value, "CaptionProgram"),
        inline<CaptionDisplaySequence>(inputs.display?.value, "CaptionDisplaySequence"),
        inline<ProgramSpace>(inputs.space?.value, "ProgramSpace"),
      )) } },
      needs: {},
    }),
  }],
} satisfies ComponentPackage;
