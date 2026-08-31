import type { ComponentPackage, ProducerHandlerContext } from "@qflow/component-kit";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import type { Text } from "@qflow/text";
import { verifyText } from "@qflow/text";

import { geminiModels, geminiProducers, geminiTypes } from "./manifest.js";
import { sealGeminiRequest, verifyGeminiRequest } from "./request.js";
import type { GeminiRequest } from "./request.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as unknown as T;
}

function text(value: StoredValue | undefined, subject: string): string {
  const result = inline<Text>(value, subject);
  verifyText(result);
  return result.value;
}

export const geminiComponent = {
  validators: [
    { type: geminiTypes.request, handler: ({ value }) => verifyGeminiRequest(inline(value, "Gemini request")) },
    { type: geminiTypes.draft, handler: ({ value }) => verifyGeminiRequest(inline(value, "Gemini request draft")) },
  ],
  producers: [
    {
      producer: geminiProducers.start,
      handler: ({ inputs }: ProducerHandlerContext) => ({
        outputs: { draft: { kind: "inline", value: canonicalize(sealGeminiRequest({
          instruction: text(inputs.instruction?.value, "Gemini instruction"),
          prompt: text(inputs.prompt?.value, "Gemini prompt"),
          media: [],
        })) } },
        needs: {},
      }),
    },
    {
      producer: geminiProducers.bindMedia,
      handler: ({ inputs }: ProducerHandlerContext) => {
        const draft = inline<GeminiRequest>(inputs.draft?.value, "Gemini request draft");
        verifyGeminiRequest(draft);
        const artifact = inputs.media?.value;
        if (artifact?.kind !== "blob") throw new Error("Gemini media must be a Blob Artifact");
        return {
          outputs: { draft: { kind: "inline", value: canonicalize(sealGeminiRequest({
            ...draft, media: [...draft.media, { artifact }],
          })) } },
          needs: {},
        };
      },
    },
    {
      producer: geminiProducers.finalize,
      handler: ({ inputs }: ProducerHandlerContext) => {
        const draft = inline<GeminiRequest>(inputs.draft?.value, "Gemini request draft");
        verifyGeminiRequest(draft);
        return { outputs: { request: { kind: "inline", value: canonicalize(draft) } }, needs: {} };
      },
    },
    ...geminiModels.map((model) => ({
      producer: geminiProducers[model],
      handler: ({ inputs }: ProducerHandlerContext) => {
        const request = inline<GeminiRequest>(inputs.request?.value, `${model} request`);
        verifyGeminiRequest(request);
        return { outputs: {}, needs: { text: canonicalize(request) } };
      },
    })),
  ],
} satisfies ComponentPackage;
