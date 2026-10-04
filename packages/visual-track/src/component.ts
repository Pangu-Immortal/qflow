import type { ComponentPackage, ProducerHandlerContext } from "@qflow/component-kit";
import type { CompositableSurfaceRef, SynchronizedMedia } from "@qflow/media";
import { canonicalize } from "@qflow/protocol";
import type { BlobRef, StoredValue } from "@qflow/protocol";
import type { ContentFit, IntrinsicExtent, SpatialFrame, SpatialMap2D, SpatialPath } from "@qflow/spatial";
import type { TemporalWindow } from "@qflow/temporal";
import type { Timeline } from "@qflow/timeline";

import {
  appendMediaPaintLayer,
  appendMappedStillMediaLayer,
  appendMappedSurfaceMediaLayer,
  appendMappedTimedMediaLayer,
  appendStillMediaLayer,
  appendSurfaceMediaLayer,
  appendTimedMediaLayer,
  createMediaLayerSet,
} from "./layers.js";
import { visualTrackProducers, visualTrackTypes } from "./manifest.js";
import {
  appendVisualClip,
  assertVisualTrackProgram,
  bindVisualClipMotion,
  bindVisualClipPath,
  createVisualTrackSet,
  finalizeVisualTrack,
  projectVisualTrack,
} from "./program.js";
import type {
  MediaLayerSet,
  MediaPaintLayerSpec,
  MediaSampleLayerSpec,
  VisualClipMotion,
  VisualClipSpec,
  VisualTrackHeader,
  VisualTrackProgram,
  VisualTrackSet,
} from "./types.js";

function inline<T>(value: StoredValue | undefined, label: string): T {
  if (value?.kind !== "inline") throw new Error(`${label} must be inline.`);
  return value.value as unknown as T;
}

function blob(value: StoredValue | undefined): BlobRef {
  if (value?.kind !== "blob") throw new Error("Visual source must be a BlobArtifact.");
  return value;
}

const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

function clipInputs(inputs: ProducerHandlerContext["inputs"]) {
  return {
    set: inline<VisualTrackSet>(inputs.set?.value, "VisualTrackSet"),
    header: inline<VisualTrackHeader>(inputs.header?.value, "VisualTrackHeader"),
    timeline: inline<Timeline>(inputs.timeline?.value, "Timeline"),
    layers: inline<MediaLayerSet>(inputs.layers?.value, "MediaLayerSet"),
    frame: inline<SpatialFrame>(inputs.frame?.value, "SpatialFrame"),
    spec: inline<VisualClipSpec>(inputs.spec?.value, "VisualClipSpec"),
    window: inline<TemporalWindow>(inputs.window?.value, "TemporalWindow"),
  };
}

export const visualTrackComponent = {
  producers: [
    { producer: visualTrackProducers.createLayers, handler: () => ({ outputs: { layers: output(createMediaLayerSet()) }, needs: {} }) },
    { producer: visualTrackProducers.appendPaintLayer, handler: ({ inputs }) => ({ outputs: { layers: output(appendMediaPaintLayer(
      inline<MediaLayerSet>(inputs.layers?.value, "MediaLayerSet"),
      inline<MediaPaintLayerSpec>(inputs.spec?.value, "MediaPaintLayerSpec"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.appendStillLayer, handler: ({ inputs }) => ({ outputs: { layers: output(appendStillMediaLayer(
      inline<MediaLayerSet>(inputs.layers?.value, "MediaLayerSet"), blob(inputs.source?.value),
      inline<IntrinsicExtent>(inputs.extent?.value, "IntrinsicExtent"), inline<ContentFit>(inputs.fit?.value, "ContentFit"),
      inline<MediaSampleLayerSpec>(inputs.spec?.value, "MediaSampleLayerSpec"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.appendMappedStillLayer, handler: ({ inputs }) => ({ outputs: { layers: output(appendMappedStillMediaLayer(
      inline<MediaLayerSet>(inputs.layers?.value, "MediaLayerSet"), blob(inputs.source?.value),
      inline<IntrinsicExtent>(inputs.extent?.value, "IntrinsicExtent"), inline<SpatialMap2D>(inputs.mapping?.value, "SpatialMap2D"),
      inline<MediaSampleLayerSpec>(inputs.spec?.value, "MediaSampleLayerSpec"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.appendTimedLayer, handler: ({ inputs }) => ({ outputs: { layers: output(appendTimedMediaLayer(
      inline<MediaLayerSet>(inputs.layers?.value, "MediaLayerSet"), inline<SynchronizedMedia>(inputs.source?.value, "SynchronizedMedia"),
      inline<ContentFit>(inputs.fit?.value, "ContentFit"), inline<MediaSampleLayerSpec>(inputs.spec?.value, "MediaSampleLayerSpec"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.appendMappedTimedLayer, handler: ({ inputs }) => ({ outputs: { layers: output(appendMappedTimedMediaLayer(
      inline<MediaLayerSet>(inputs.layers?.value, "MediaLayerSet"), inline<SynchronizedMedia>(inputs.source?.value, "SynchronizedMedia"),
      inline<SpatialMap2D>(inputs.mapping?.value, "SpatialMap2D"), inline<MediaSampleLayerSpec>(inputs.spec?.value, "MediaSampleLayerSpec"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.appendSurfaceLayer, handler: ({ inputs }) => ({ outputs: { layers: output(appendSurfaceMediaLayer(
      inline<MediaLayerSet>(inputs.layers?.value, "MediaLayerSet"), inline<CompositableSurfaceRef>(inputs.source?.value, "CompositableSurfaceRef"),
      inline<ContentFit>(inputs.fit?.value, "ContentFit"), inline<MediaSampleLayerSpec>(inputs.spec?.value, "MediaSampleLayerSpec"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.appendMappedSurfaceLayer, handler: ({ inputs }) => ({ outputs: { layers: output(appendMappedSurfaceMediaLayer(
      inline<MediaLayerSet>(inputs.layers?.value, "MediaLayerSet"), inline<CompositableSurfaceRef>(inputs.source?.value, "CompositableSurfaceRef"),
      inline<SpatialMap2D>(inputs.mapping?.value, "SpatialMap2D"), inline<MediaSampleLayerSpec>(inputs.spec?.value, "MediaSampleLayerSpec"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.createSet, handler: () => ({ outputs: { set: output(createVisualTrackSet()) }, needs: {} }) },
    { producer: visualTrackProducers.appendClip, handler: ({ inputs }) => {
      const value = clipInputs(inputs);
      return { outputs: { set: output(appendVisualClip(
        value.set, value.header, value.timeline, value.layers, value.frame, value.spec, value.window,
      )) }, needs: {} };
    } },
    { producer: visualTrackProducers.bindClipPath, handler: ({ inputs }) => ({ outputs: { spec: output(bindVisualClipPath(
      inline<VisualClipSpec>(inputs.spec?.value, "VisualClipSpec"), inline<SpatialPath>(inputs.path?.value, "SpatialPath"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.bindMotion, handler: ({ inputs }) => ({ outputs: { spec: output(bindVisualClipMotion(
      inline<VisualClipSpec>(inputs.spec?.value, "VisualClipSpec"), inline<VisualClipMotion>(inputs.motion?.value, "VisualClipMotion"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.finalize, handler: ({ inputs }) => ({ outputs: { program: output(finalizeVisualTrack(
      inline<VisualTrackSet>(inputs.set?.value, "VisualTrackSet"), inline<VisualTrackHeader>(inputs.header?.value, "VisualTrackHeader"),
      inline<Timeline>(inputs.timeline?.value, "Timeline"),
    )) }, needs: {} }) },
    { producer: visualTrackProducers.projectVisual, handler: ({ inputs }) => ({ outputs: { track: output(projectVisualTrack(
      inline<Timeline>(inputs.timeline?.value, "Timeline"), inline<VisualTrackProgram>(inputs.program?.value, "VisualTrackProgram"),
    )) }, needs: {} }) },
  ],
  validators: [{
    type: visualTrackTypes.program,
    handler: ({ value }) => assertVisualTrackProgram(inline<VisualTrackProgram>(value, "VisualTrackProgram")),
  }],
} satisfies ComponentPackage;
