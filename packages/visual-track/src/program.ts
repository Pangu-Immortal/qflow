import { assertVisualTrackIdentity, sealVisualTrack } from "@qflow/composition";
import type { VisualTrack } from "@qflow/composition";
import { canonicalize } from "@qflow/qflow/protocol";
import { assertSpatialFrame, assertSpatialPath } from "@qflow/spatial";
import type { SpatialPath } from "@qflow/spatial";
import { assertTemporalWindowFor } from "@qflow/temporal";
import type { TemporalWindow } from "@qflow/temporal";
import { assertTimelineIdentity, timelineFrameCount } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";

import {
  assertMediaIdentity,
  assertMediaLayerSet,
} from "./layers.js";
import { lowerVisualClipElements } from "./lower.js";
import { assertVisualClipMotion, poseAnimation } from "./motion.js";
import { assertVisualFrameTreatment } from "./frame-treatment.js";
import { assertMediaLayerPrograms, assertResolvedSampleLayer, resolveMediaLayerPrograms } from "./spatial.js";
import type {
  MediaLayerSet,
  MediaSampleLayerProgram,
  VisualClipProgram,
  VisualClipMotion,
  VisualClipSpec,
  VisualTrackHeader,
  VisualTrackProgram,
  VisualTrackSet,
} from "./types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function bindVisualClipPath(spec: VisualClipSpec, path: SpatialPath): VisualClipSpec {
  assertVisualClipSpec(spec);
  assertSpatialPath(path);
  return sealVisualClipSpec({
    ...spec,
    treatment: { ...spec.treatment, clip: { kind: "path", path: structuredClone(path) } },
  });
}

export function bindVisualClipMotion(spec: VisualClipSpec, motion: VisualClipMotion): VisualClipSpec {
  assertVisualClipSpec(spec);
  assertVisualClipMotion(motion, "VisualClipMotion");
  return sealVisualClipSpec({ ...spec, motion: structuredClone(motion) });
}

export function assertVisualClipSpec(value: VisualClipSpec): void {
  assertMediaIdentity(value.id, "VisualClipSpec.id");
  assertVisualFrameTreatment(value.treatment, "VisualClipSpec.treatment");
  if (value.motion !== undefined) assertVisualClipMotion(value.motion, "VisualClipSpec.motion");
  assert(Number.isSafeInteger(value.z), "VisualClipSpec.z must be an integer.");
}

export function sealVisualClipSpec(value: VisualClipSpec): VisualClipSpec {
  assertVisualClipSpec(value);
  return canonicalize(value) as unknown as VisualClipSpec;
}

export function sealVisualTrackHeader(value: VisualTrackHeader): VisualTrackHeader {
  assertVisualTrackHeader(value);
  return canonicalize(value) as unknown as VisualTrackHeader;
}

export function assertVisualTrackHeader(value: VisualTrackHeader): void {
  assertMediaIdentity(value.id, "VisualTrackHeader.id");
}

export function createVisualTrackSet(): VisualTrackSet {
  return { clips: [] };
}

export function assertVisualTrackSet(value: VisualTrackSet): void {
  assert(Array.isArray(value.clips), "VisualTrackSet is invalid.");
}

/** Component entry point: source facts, absolute placement and visual treatment are already explicit. */
export function appendVisualClip(
  set: VisualTrackSet,
  header: VisualTrackHeader,
  timeline: Timeline,
  layers: MediaLayerSet,
  frame: VisualClipProgram["frame"],
  spec: VisualClipSpec,
  window: TemporalWindow,
): VisualTrackSet {
  assertVisualTrackSet(set);
  assertVisualTrackHeader(header);
  assertTimelineIdentity(timeline);
  assertMediaLayerSet(layers);
  assert(layers.layers.length > 0, `Visual Clip ${spec.id} requires at least one layer.`);
  assertSpatialFrame(frame);
  assertVisualClipSpec(spec);
  assertTemporalWindowFor(window, { subjectId: spec.id, timeline });
  const resolvedLayers = resolveMediaLayerPrograms(layers, frame, spec.treatment);
  const duration = window.span.endFrameExclusive - window.span.startFrame;
  if (spec.motion !== undefined) {
    assertVisualClipMotion(spec.motion, `Visual Clip ${spec.id} motion`);
    poseAnimation(spec.motion, duration);
  }
  const addition: VisualClipProgram = {
    id: window.id,
    subjectId: spec.id,
    span: { ...window.span },
    frame: { ...frame },
    treatment: structuredClone(spec.treatment),
    layers: structuredClone(resolvedLayers),
    ...(spec.motion === undefined ? {} : { motion: structuredClone(spec.motion) }),
    order: set.clips.length,
    z: spec.z,
  };
  assert(!set.clips.some((clip) => clip.id === addition.id), `Visual Track ${header.id} already contains ${addition.id}.`);
  return { clips: [...set.clips, addition] };
}

function assertSampleLayerForTimeline(layer: MediaSampleLayerProgram, timeline: Timeline, label: string): void {
  assertResolvedSampleLayer(layer, label);
  const timing = layer.source.kind === "timed"
    ? { frameRate: layer.source.frameRate, frameCount: layer.source.frameCount }
    : layer.source.kind === "surface" && layer.source.surface.timing.kind === "frames"
      ? layer.source.surface.timing
      : undefined;
  if (timing === undefined) {
    assert(layer.sourceTime === undefined, `${label} is still material and cannot have source time.`);
    return;
  }
  assert(
    timing.frameRate.numerator === timeline.frameRate.numerator
      && timing.frameRate.denominator === timeline.frameRate.denominator,
    `${label} is not normalized to Timeline frame rate.`,
  );
  assert(layer.sourceTime !== undefined, `${label} requires source time.`);
}

function assertClip(clip: VisualClipProgram, timeline: Timeline, label: string): void {
  assertMediaIdentity(clip.id, `${label}.id`);
  assertMediaIdentity(clip.subjectId, `${label}.subjectId`);
  assert(
    Number.isSafeInteger(clip.span.startFrame)
      && Number.isSafeInteger(clip.span.endFrameExclusive)
      && clip.span.startFrame >= 0
      && clip.span.endFrameExclusive > clip.span.startFrame
      && clip.span.endFrameExclusive <= timelineFrameCount(timeline),
    `${label}.span is invalid.`,
  );
  assertSpatialFrame(clip.frame);
  assertVisualFrameTreatment(clip.treatment, `${label}.treatment`);
  if (clip.motion !== undefined) {
    assertVisualClipMotion(clip.motion, `${label}.motion`);
    poseAnimation(clip.motion, clip.span.endFrameExclusive - clip.span.startFrame);
  }
  assert(Number.isSafeInteger(clip.order) && clip.order >= 0, `${label}.order is invalid.`);
  assert(Number.isSafeInteger(clip.z), `${label}.z is invalid.`);
  assert(clip.layers.length > 0, `${label} requires layers.`);
  assertMediaLayerPrograms(clip.layers);
  for (const layer of clip.layers) {
    if (layer.kind === "sample") assertSampleLayerForTimeline(layer, timeline, `${label}.${layer.id}`);
  }
}

function normalizeProgram(value: VisualTrackProgram): VisualTrackProgram {
  return {
    id: value.id,
    clips: [...value.clips].map((clip) => structuredClone(clip)).sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function sealVisualTrackProgram(value: VisualTrackProgram, timeline: Timeline): VisualTrackProgram {
  const normalized = normalizeProgram(value);
  assertVisualTrackProgramIdentity(normalized, timeline);
  return canonicalize(normalized) as unknown as VisualTrackProgram;
}

export function finalizeVisualTrack(set: VisualTrackSet, header: VisualTrackHeader, timeline: Timeline): VisualTrackProgram {
  assertVisualTrackSet(set);
  assertVisualTrackHeader(header);
  assert(set.clips.length > 0, "Visual Track requires at least one Clip.");
  return sealVisualTrackProgram({ id: header.id, clips: set.clips }, timeline);
}

export function assertVisualTrackProgram(value: VisualTrackProgram): void {
  assertMediaIdentity(value.id, "VisualTrackProgram.id");
  assert(Array.isArray(value.clips) && value.clips.length > 0, "VisualTrackProgram is empty.");
}

export function assertVisualTrackProgramIdentity(value: VisualTrackProgram, timeline: Timeline): void {
  assertVisualTrackProgram(value);
  assertTimelineIdentity(timeline);
  const ids = new Set<string>();
  for (const clip of value.clips) {
    assert(!ids.has(clip.id), `VisualTrackProgram repeats ${clip.id}.`);
    ids.add(clip.id);
    assertClip(clip, timeline, `Visual Clip ${clip.id}`);
  }
}

export function projectVisualTrack(timeline: Timeline, program: VisualTrackProgram): VisualTrack {
  assertVisualTrackProgramIdentity(program, timeline);
  const track = sealVisualTrack({
    timelineId: timeline.id,
    visualIr: "qflow.visual-ir@1",
    id: program.id,
    presents: program.clips.map((clip) => ({
      id: clip.id,
      order: clip.order,
      z: clip.z,
      subjectId: clip.subjectId,
      span: { ...clip.span },
      elements: lowerVisualClipElements(clip, timeline),
    })),
  });
  assertVisualTrackIdentity(track, timeline);
  return track;
}
