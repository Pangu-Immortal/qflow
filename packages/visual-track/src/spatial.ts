import {
  assertSpatialFrame,
  assertSpatialMap2D,
  resolveContentFit,
} from "@qflow/spatial";
import type { SpatialFrame } from "@qflow/spatial";

import { assertVisualFrameTreatment, visualContentFrame } from "./frame-treatment.js";
import {
  assertMediaLayerSet,
  assertMediaPaintLayerSpec,
  assertMediaSampleLayerSpec,
  assertMediaVisualSource,
} from "./layers.js";
import type {
  MediaLayerProgram,
  MediaLayerSet,
  MediaSampleLayerProgram,
  VisualFrameTreatment,
} from "./types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Resolve every author placement exactly once, at the point its Clip Frame is known. */
export function resolveMediaLayerPrograms(
  set: MediaLayerSet,
  frame: SpatialFrame,
  treatment: VisualFrameTreatment,
): readonly MediaLayerProgram[] {
  assertMediaLayerSet(set);
  assertSpatialFrame(frame);
  assertVisualFrameTreatment(treatment, "VisualFrameTreatment");
  const fitFrame = set.layers.some((layer) => layer.kind === "sample" && layer.placement.kind === "fit")
    ? visualContentFrame(frame, treatment)
    : undefined;
  return set.layers.map((layer): MediaLayerProgram => {
    if (layer.kind === "paint") return structuredClone(layer);
    let mapping;
    if (layer.placement.kind === "fit") {
      assert(fitFrame !== undefined, `Media layer ${layer.id} has no fitting Frame.`);
      mapping = resolveContentFit(fitFrame, layer.source.extent, layer.placement.fit);
    } else {
      mapping = layer.placement.mapping;
    }
    assertSpatialMap2D(mapping);
    const { placement: _placement, ...rest } = layer;
    return { ...structuredClone(rest), mapping: structuredClone(mapping) };
  });
}

export function assertMediaLayerPrograms(value: readonly MediaLayerProgram[]): void {
  assert(Array.isArray(value) && value.length > 0, "Resolved Media layers are empty.");
  const ids = new Set<string>();
  for (const layer of value) {
    assert(!ids.has(layer.id), `Resolved Media layers repeat ${layer.id}.`);
    ids.add(layer.id);
    if (layer.kind === "paint") {
      assertMediaPaintLayerSpec(layer);
      continue;
    }
    assertMediaVisualSource(layer.source, `Media layer ${layer.id}.source`);
    assertSpatialMap2D(layer.mapping);
    assertMediaSampleLayerSpec({
      id: layer.id,
      ...(layer.sourceTime?.kind !== "spec" ? {} : { sourceTime: layer.sourceTime.value }),
      appearance: layer.appearance,
      ...(layer.samplingMotion === undefined ? {} : { samplingMotion: layer.samplingMotion }),
    });
  }
}

export function assertResolvedSampleLayer(value: MediaSampleLayerProgram, label: string): void {
  assertMediaVisualSource(value.source, `${label}.source`);
  assertSpatialMap2D(value.mapping);
}
