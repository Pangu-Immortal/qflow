import type { ComponentPackage } from "@qflow/component-kit";
import type { Composition } from "@qflow/composition";
import type { Timeline } from "@qflow/timeline";
import type { CanonicalValue, StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";

import { compileHyperframesDocument } from "./document.js";
import { hyperframesProducers } from "./manifest.js";

function inline(value: StoredValue, subject: string): CanonicalValue {
  if (value.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value;
}

/** Trusted deterministic lowering only; this component never renders frames or reads Artifacts. */
export const hyperframesComponent = {
  producers: [{
    producer: hyperframesProducers.compile,
    handler: ({ inputs }) => ({
      outputs: {
        document: {
          kind: "inline",
          value: canonicalize(compileHyperframesDocument(
            inline(inputs.composition!.value, "Composition") as unknown as Composition,
            inline(inputs.timeline!.value, "Timeline") as unknown as Timeline,
          )),
        },
      },
      needs: {},
    }),
  }],
} satisfies ComponentPackage;
