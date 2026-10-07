import type { AdmissionPackage } from "@qflow/admission";
import type { ProducerPackage } from "@qflow/producer";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import { anchoredFrame, aspectFrame, assertCanvas, assertContentFit, assertIntrinsicExtent, assertSpatialFrame, assertSpatialMap2D, assertSpatialPath, assertSpatialPoint, frameFromEdges, resolveContentFit } from "./geometry.js";
import { spatialProducers, spatialTypes } from "./manifest.js";
import type {
  AnchoredFrameProgram,
  AspectFrameProgram,
  Canvas,
  ContentFit,
  FrameEdgesProgram,
  IntrinsicExtent,
  SpatialFrame,
  SpatialMap2D,
  SpatialPath,
  SpatialPoint,
} from "./types.js";

function inline<T>(value: StoredValue | undefined, label: string): T {
  if (value?.kind !== "inline") throw new Error(`${label} must be inline.`);
  return value.value as unknown as T;
}
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

export const spatialComponent = {
  producers: [
    { producer: spatialProducers.frameEdges, handler: ({ inputs }) => ({ outputs: { frame: output(frameFromEdges(inline<SpatialFrame>(inputs.parent?.value, "SpatialFrame"), inline<FrameEdgesProgram>(inputs.program?.value, "FrameEdgesProgram"))) }, needs: {} }) },
    { producer: spatialProducers.anchoredFrame, handler: ({ inputs }) => ({ outputs: { frame: output(anchoredFrame(inline<SpatialFrame>(inputs.parent?.value, "SpatialFrame"), inline<AnchoredFrameProgram>(inputs.program?.value, "AnchoredFrameProgram"))) }, needs: {} }) },
    { producer: spatialProducers.aspectFrame, handler: ({ inputs }) => ({ outputs: { frame: output(aspectFrame(inline<SpatialFrame>(inputs.parent?.value, "SpatialFrame"), inline<IntrinsicExtent>(inputs.extent?.value, "IntrinsicExtent"), inline<AspectFrameProgram>(inputs.program?.value, "AspectFrameProgram"))) }, needs: {} }) },
    { producer: spatialProducers.resolveContentFit, handler: ({ inputs }) => ({ outputs: { mapping: output(resolveContentFit(inline<SpatialFrame>(inputs.frame?.value, "SpatialFrame"), inline<IntrinsicExtent>(inputs.extent?.value, "IntrinsicExtent"), inline<ContentFit>(inputs.fit?.value, "ContentFit"))) }, needs: {} }) },
  ],
  validators: [
    { type: spatialTypes.canvas, handler: ({ value }) => assertCanvas(inline<Canvas>(value, "Canvas")) },
    { type: spatialTypes.point, handler: ({ value }) => assertSpatialPoint(inline<SpatialPoint>(value, "SpatialPoint")) },
    { type: spatialTypes.frame, handler: ({ value }) => assertSpatialFrame(inline<SpatialFrame>(value, "SpatialFrame")) },
    { type: spatialTypes.path, handler: ({ value }) => assertSpatialPath(inline<SpatialPath>(value, "SpatialPath")) },
    { type: spatialTypes.extent, handler: ({ value }) => assertIntrinsicExtent(inline<IntrinsicExtent>(value, "IntrinsicExtent")) },
    { type: spatialTypes.map2D, handler: ({ value }) => assertSpatialMap2D(inline<SpatialMap2D>(value, "SpatialMap2D")) },
    { type: spatialTypes.fit, handler: ({ value }) => assertContentFit(inline<ContentFit>(value, "ContentFit")) },
  ],
} satisfies ProducerPackage & AdmissionPackage;
