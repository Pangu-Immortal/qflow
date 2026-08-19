import type { ComponentPackage } from "@qflow/component-kit";
import type { CaptionProgram } from "@qflow/caption";
import type { CaptionDisplaySequence } from "@qflow/narrative";
import type { StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";

import { captionGeminiProducers, captionGeminiTypes } from "./manifest.js";
import { verifyCaptionGeminiProgram } from "./program.js";
import { compileCaptionGeminiRequest, verifyCaptionGeminiRequest } from "./request.js";
import type { CaptionGeminiProgram, CaptionGeminiRequest } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

export const captionGeminiComponent = {
  producers: [
    {
      producer: captionGeminiProducers.compile,
      handler: ({ inputs }) => ({
        outputs: {
          request: {
            kind: "inline",
            value: canonicalize(compileCaptionGeminiRequest(
              inline<CaptionDisplaySequence>(inputs.display?.value, "CaptionDisplaySequence"),
              inline<CaptionProgram>(inputs.captionProgram?.value, "CaptionProgram"),
              inline<CaptionGeminiProgram>(inputs.program?.value, "CaptionGeminiProgram"),
            )),
          },
        },
        needs: {},
      }),
    },
    {
      producer: captionGeminiProducers.request,
      handler: ({ inputs }) => {
        const request = inline<CaptionGeminiRequest>(inputs.request?.value, "CaptionGeminiRequest");
        verifyCaptionGeminiRequest(request);
        return { outputs: {}, needs: { plan: canonicalize(request) } };
      },
    },
  ],
  validators: [
    {
      type: captionGeminiTypes.program,
      handler: ({ value }) => verifyCaptionGeminiProgram(inline(value, "CaptionGeminiProgram")),
    },
    {
      type: captionGeminiTypes.request,
      handler: ({ value }) => verifyCaptionGeminiRequest(inline(value, "CaptionGeminiRequest")),
    },
  ],
} satisfies ComponentPackage;
