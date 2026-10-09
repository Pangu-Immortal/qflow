import { sealVisualTrack } from "@qflow/composition";
import type { Timeline } from "@qflow/timeline";
import type { SpatialFrame } from "@qflow/spatial";
import { canonicalize } from "@qflow/qflow/protocol";
import type { BlobRef, TypedRecord } from "@qflow/qflow/protocol";
import type { ProducerPackage, ProducerHandler } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import { VISUAL_IR_V1 } from "@qflow/composition";
import { exampleProducers, exampleTypes } from "./manifest.js";

const inline = <T>(record: { readonly value: { readonly kind: string; readonly value?: unknown } } | undefined): T => {
  if (record?.value.kind !== "inline") throw new Error("example producer input must be inline");
  return record.value.value as T;
};
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });
function image(record: TypedRecord | undefined): BlobRef | undefined {
  if (record === undefined) return undefined;
  if (record.value.kind !== "blob" || !record.value.mediaType.startsWith("image/")) {
    throw new Error("example ImageSlot input must be an image Blob Artifact");
  }
  return record.value;
}
function render(kind: string, timeline: Timeline, within: SpatialFrame, image?: BlobRef) {
  const frames = timeline.frameCount;
  return sealVisualTrack({
    timelineId: timeline.id,
    visualIr: VISUAL_IR_V1,
    id: `example-${kind}`,
    presents: [{ id: `present-${kind}`, order: 0, z: 0, span: { startFrame: 0, endFrameExclusive: frames }, elements: [{
      id: `${kind}-root`, kind: "box", order: 0,
      style: [{ name: "position", value: "absolute" }, { name: "left", value: `${within.xPx}px` },
        { name: "top", value: `${within.yPx}px` }, { name: "width", value: `${within.widthPx}px` },
        { name: "height", value: `${within.heightPx}px` }, { name: "background-color", value: "#6b7280" }],
    }, ...(kind === "image" && image !== undefined ? [{ id: `${kind}-content`, parent: `${kind}-root`, kind: "image" as const, artifact: image, order: 1, style: [{ name: "position", value: "absolute" }, { name: "left", value: 0 }, { name: "top", value: 0 }, { name: "width", value: "100%" }, { name: "height", value: "100%" }, { name: "object-fit", value: "contain" }] }] : []),
    ] }],
  });
}
const producer = (kind: string): { readonly handler: ProducerHandler } => ({ handler: ({ inputs }) => ({ outputs: { visual: output(render(kind,
  inline<Timeline>(inputs.timeline), inline<SpatialFrame>(inputs.within), image(inputs.image))) }, needs: {} }) });
const appendItems: { readonly handler: ProducerHandler } = { handler: ({ inputs }) => ({ outputs: { set: output({ items: [inline<{ items: readonly unknown[] }>(inputs.previous).items, inline<{ items: readonly unknown[] }>(inputs.item).items].flat() }) }, needs: {} }) };

export const exampleComponent = {
  producers: [
    { producer: exampleProducers.renderBox, ...producer("box") },
    { producer: exampleProducers.renderText, ...producer("text") },
    { producer: exampleProducers.renderImage, ...producer("image") },
    { producer: exampleProducers.appendItems, ...appendItems },
  ],
  validators: [
    { type: exampleTypes.box, handler: () => {} },
    { type: exampleTypes.text, handler: () => {} },
    { type: exampleTypes.imageSlot, handler: () => {} },
  ],
} satisfies ProducerPackage & AdmissionPackage;
