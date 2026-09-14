import type { MediaFrameRange } from "@qflow/media";
import { plannedNeedInputs } from "@qflow/component-kit";
import type { ComponentPackage } from "@qflow/component-kit";
import type { StoredValue } from "@qflow/protocol";

import { hyperframesVisualRequest } from "./product.js";
import type { HyperframesVisualRequest } from "./product.js";
import { renderHyperframesCapabilities, renderHyperframesProducers } from "./manifest.js";

/** Declares the visual Need. It contains no renderer, queue, credentials or deployment choice. */
export const renderHyperframesComponent = {
  producers: [renderHyperframesProducers.requestVisual, renderHyperframesProducers.requestVisualRange].map((producer) => ({
    producer,
    handler: ({ inputs }) => ({
      outputs: {},
      needs: {
        visual: hyperframesVisualRequest(inline(inputs.document!.value, "HyperframesDocument") as never,
          inputs.range === undefined ? {} : { range: inline(inputs.range.value, "MediaFrameRange") as MediaFrameRange }),
      },
    }),
  })),
  plannedNeeds: [renderHyperframesProducers.requestVisual, renderHyperframesProducers.requestVisualRange].map((producer) => ({
    producer,
    port: "visual",
    capability: renderHyperframesCapabilities.renderVisual,
    plan({ state, step }) {
      return { constraints: {}, pendingInputs: plannedNeedInputs(state, step) };
    },
    present(specification) {
      const request = specification.constraints as Partial<HyperframesVisualRequest>;
      if (request.document === undefined) return { fields: {}, references: {} };
      const { document, range } = request;
      const startFrame = range?.startFrame ?? 0;
      const endFrameExclusive = range?.endFrameExclusive ?? document.frameCount;
      return { fields: {
        width: [document.canvas.width], height: [document.canvas.height],
        startFrame: [startFrame], endFrameExclusive: [endFrameExclusive],
        frameRate: [`${document.frameRate.numerator}/${document.frameRate.denominator}`],
      }, references: {} };
    },
  })),
} satisfies ComponentPackage;

function inline(value: StoredValue, subject: string): unknown {
  if (value.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value;
}
