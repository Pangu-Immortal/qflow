import type { TemporalWindow } from "@qflow/temporal";
import type { ComponentPackage } from "@qflow/component-kit";
import type { CaptionDocument } from "@qflow/narrative";
import type { Timeline } from "@qflow/timeline";
import type { StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";

import { captionProducers, captionTypes } from "./manifest.js";
import { appendCaptionUse, assertCaptionProgram, assertCaptionStyle } from "./style.js";
import { assertTimedCaptionProjection, temporalizeCaptionDocument } from "./temporalize.js";
import type { CaptionProgram, CaptionStyleIntent, TimedCaptionProjection } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

export const captionComponent = {
  producers: [{
    producer: captionProducers.create,
    handler: ({ inputs }) => ({ outputs: { program: { kind: "inline", value: canonicalize({
      id: inline<{id:string}>(inputs.header?.value, "CaptionTrackSpec").id,
      documentId: inline<CaptionDocument>(inputs.document?.value, "CaptionDocument").id,
      styles: [], uses: [],
    }) } }, needs: {} }),
  }, {
    producer: captionProducers.append,
    handler: ({ inputs }) => ({ outputs: { program: { kind: "inline", value: canonicalize(appendCaptionUse(
      inline<CaptionProgram>(inputs.program?.value, "CaptionProgram"),
      inline<TemporalWindow>(inputs.window?.value, "TemporalWindow"),
      inline<CaptionStyleIntent>(inputs.style?.value, "CaptionStyle"),
      inline<{role?:string}>(inputs.filter?.value, "CaptionContentFilter").role,
    )) } }, needs: {} }),
  }, {
    producer: captionProducers.temporalizeDocument,
    handler: ({ inputs }) => ({
      outputs: { caption: { kind: "inline", value: canonicalize(temporalizeCaptionDocument(
        inline<CaptionDocument>(inputs.document?.value, "CaptionDocument"),
        inline<Timeline>(inputs.timeline?.value, "Timeline"),
      )) } },
      needs: {},
    }),
  }],
  validators: [
    { type: captionTypes.style, handler: ({ value }) => {
      if (value.kind !== "inline") throw new Error("CaptionStyle must be inline");
      const style = value.value as CaptionStyleIntent;
      assertCaptionStyle(style);
    } },
    { type: captionTypes.program, handler: ({ value }) => assertCaptionProgram(inline<CaptionProgram>(value, "CaptionProgram")) },
    { type: captionTypes.timedProjection, handler: ({ value }) => assertTimedCaptionProjection(inline<TimedCaptionProjection>(value, "TimedCaptionProjection")) },
  ],
} satisfies ComponentPackage;
