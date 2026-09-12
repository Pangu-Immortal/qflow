import { sealVisualTrack } from "@qflow/qflow/composition";
import type { Timeline } from "@qflow/qflow/timeline";
import { canonicalize } from "@qflow/qflow/author-kit";
import type { BlobRef, ComponentPackage, ProducerHandler, TypedRecord } from "@qflow/qflow/author-kit";
import { VISUAL_IR_V1 } from "@qflow/qflow/visual-ir";
import { exampleProducers, exampleTypes } from "./manifest.js";

const inline = <T>(record: { readonly value: { readonly kind: string; readonly value?: unknown } } | undefined): T => {
  if (record?.value.kind !== "inline") throw new Error("example producer input must be inline");
  return record.value.value as T;
};
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });
function blob(record: TypedRecord | undefined): BlobRef | undefined {
  return record?.value.kind === "blob" ? record.value : undefined;
}
function render(kind: string, timeline: Timeline, media?: BlobRef) {
  const frames = Math.max(1, Math.round(timeline.durationSec * timeline.frameRate.numerator / timeline.frameRate.denominator));
  return sealVisualTrack({
    programSpaceId: timeline.id,
    visualIr: VISUAL_IR_V1,
    id: `example-${kind}`,
    presents: [{ id: `present-${kind}`, span: { startFrame: 0, endFrameExclusive: frames }, stacking: { order: 0, tieBreak: kind }, elements: [{
      id: `${kind}-root`, kind: "box", order: 0,
      style: [{ name: "background-color", value: "#6b7280" }],
    }, ...(kind === "media" && media !== undefined ? [{ id: `${kind}-content`, parent: `${kind}-root`, kind: media.mediaType.startsWith("video/") ? "video" as const : "image" as const, artifact: media, order: 1, style: [{ name: "position", value: "absolute" }, { name: "left", value: 0 }, { name: "top", value: 0 }, { name: "width", value: "100%" }, { name: "height", value: "100%" }, { name: "object-fit", value: "contain" }] }] : []),
    ] }],
  });
}
const producer = (kind: string): { readonly handler: ProducerHandler } => ({ handler: ({ inputs }) => ({ outputs: { track: output(render(kind, inline<Timeline>(inputs.timeline), blob(inputs.media))) }, needs: {} }) });
const appendItems: { readonly handler: ProducerHandler } = { handler: ({ inputs }) => ({ outputs: { set: output({ items: [inline<{ items: readonly unknown[] }>(inputs.previous).items, inline<{ items: readonly unknown[] }>(inputs.item).items].flat() }) }, needs: {} }) };

export const exampleComponent = {
  producers: [
    { producer: exampleProducers.renderBox, ...producer("box") },
    { producer: exampleProducers.renderText, ...producer("text") },
    { producer: exampleProducers.renderMedia, ...producer("media") },
    { producer: exampleProducers.appendItems, ...appendItems },
  ],
  validators: [
    { type: exampleTypes.box, handler: () => {} },
    { type: exampleTypes.text, handler: () => {} },
    { type: exampleTypes.mediaSlot, handler: () => {} },
  ],
} satisfies ComponentPackage;
