import type { AdmissionPackage } from "@qflow/qflow/admission";
import type { TemporalWindow } from "@qflow/temporal";
import type { ProducerPackage } from "@qflow/qflow/producer";
import type { StoredValue } from "@qflow/qflow/protocol";
import { canonicalize } from "@qflow/qflow/protocol";

import { captionProducers, captionTypes } from "./manifest.js";
import { appendCaptionUse, assertCaptionProgram, assertCaptionStyle } from "./style.js";
import { assertCaptionDocumentIdentity } from "./identity.js";
import { assertCaptionTiming } from "./temporalize.js";
import type { CaptionDocument, CaptionProgram, CaptionStyleIntent, CaptionTiming } from "./types.js";

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
      inline<{id:string}>(inputs.filter?.value, "CaptionContentFilter").id,
      inline<TemporalWindow>(inputs.window?.value, "TemporalWindow"),
      inline<CaptionStyleIntent>(inputs.style?.value, "CaptionStyle"),
      inline<{id:string;role?:string}>(inputs.filter?.value, "CaptionContentFilter").role,
    )) } }, needs: {} }),
  }, {
    producer: captionProducers.appendUnbounded,
    handler: ({ inputs }) => ({ outputs: { program: { kind: "inline", value: canonicalize(appendCaptionUse(
      inline<CaptionProgram>(inputs.program?.value, "CaptionProgram"),
      inline<{id:string}>(inputs.filter?.value, "CaptionContentFilter").id,
      undefined,
      inline<CaptionStyleIntent>(inputs.style?.value, "CaptionStyle"),
      inline<{id:string;role?:string}>(inputs.filter?.value, "CaptionContentFilter").role,
    )) } }, needs: {} }),
  }],
  validators: [
    { type: captionTypes.document, handler: ({ value }) => assertCaptionDocumentIdentity(inline<CaptionDocument>(value, "CaptionDocument")) },
    { type: captionTypes.style, handler: ({ value }) => {
      if (value.kind !== "inline") throw new Error("CaptionStyle must be inline");
      const style = value.value as CaptionStyleIntent;
      assertCaptionStyle(style);
    } },
    { type: captionTypes.program, handler: ({ value }) => assertCaptionProgram(inline<CaptionProgram>(value, "CaptionProgram")) },
    { type: captionTypes.timing, handler: ({ value }) => assertCaptionTiming(inline<CaptionTiming>(value, "CaptionTiming")) },
  ],
} satisfies ProducerPackage & AdmissionPackage;
