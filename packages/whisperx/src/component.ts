import type { ComponentPackage } from "@qflow/component-kit";
import type { SpeechEvidenceAudio } from "@qflow/speech";
import type { CanonicalValue, StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";

import { whisperXRequestForEvidenceAudio } from "./evidence.js";
import { whisperXProducers } from "./manifest.js";

function inline(value: StoredValue, subject: string): CanonicalValue {
  if (value.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value;
}

export const whisperXComponent = {
  producers: [
    {
      producer: whisperXProducers.request,
      handler: ({ inputs }) => {
        const evidence = inline(inputs.evidence!.value, "SpeechEvidenceAudio") as unknown as SpeechEvidenceAudio;
        return {
          outputs: {},
          needs: { alignment: canonicalize(whisperXRequestForEvidenceAudio(evidence)) },
        };
      },
    },
  ],
} satisfies ComponentPackage;
