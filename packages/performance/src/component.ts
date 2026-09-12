import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import type { ComponentPackage } from "@qflow/component-kit";
import type { Timeline } from "@qflow/timeline";
import { sealVisualTrack } from "@qflow/composition";
import type { VisualTrack } from "@qflow/composition";
import type { CanvasSpace, SpatialFrame, ContentFit } from "@qflow/spatial";
import type { TemporalWindow } from "@qflow/temporal";
import { createMediaLayerSet, createMediaSoundSet, createMediaTrackSet, finalizeMediaTrack, projectMediaVisualTrack } from "@qflow/media-track";
import type { MediaItemSpec, MediaSampleLayerSpec } from "@qflow/media-track";
import { appendMediaPerformance } from "./media.js";
import { appendPerformanceUse, resolvePerformance } from "./program.js";
import type { PerformanceSet } from "./program.js";
import { performanceProducers } from "./manifest.js";

function inline<T>(value: StoredValue | undefined): T {
  if (value?.kind !== "inline") throw new Error("Performance input must be inline.");
  return value.value as unknown as T;
}
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });
export function ordinaryPerformance(input: {
  timeline: Timeline; canvas: CanvasSpace; window: TemporalWindow; frame: SpatialFrame;
  fit: ContentFit; sample: MediaSampleLayerSpec; spec: MediaItemSpec;
}): VisualTrack {
  const id = input.window.subjectId;
  const header = { id };
  const set = appendMediaPerformance({ ...input, header, set: createMediaTrackSet(), layers: createMediaLayerSet(),
    sounds: createMediaSoundSet(), spec: { ...input.spec, id } }, input.fit, input.sample);
  if (set.items.length === 0) return sealVisualTrack({ id, programSpaceId: input.timeline.id, visualIr: "qflow.visual-ir@1", presents: [] });
  return projectMediaVisualTrack(input.timeline, finalizeMediaTrack(set, header, input.timeline));
}
export const performanceComponent: ComponentPackage = {
  producers: [
    { producer: performanceProducers.create, handler: () => ({ outputs: { set: output({ uses: [] }) }, needs: {} }) },
    { producer: performanceProducers.append, handler: ({ inputs }) => ({ outputs: { set: output(appendPerformanceUse(
      inline<PerformanceSet>(inputs.set?.value), inline<TemporalWindow>(inputs.window?.value), inline<VisualTrack>(inputs.visual?.value),
    )) }, needs: {} }) },
    { producer: performanceProducers.resolve, handler: ({ inputs }) => ({ outputs: { visual: output(resolvePerformance(
      inline<Timeline>(inputs.timeline?.value), inline<{ id: string }>(inputs.header?.value).id, inline<PerformanceSet>(inputs.set?.value),
    )) }, needs: {} }) },
    { producer: performanceProducers.ordinary, handler: ({ inputs }) => ({ outputs: { visual: output(ordinaryPerformance({
      timeline: inline(inputs.timeline?.value), canvas: inline(inputs.canvas?.value), window: inline(inputs.window?.value),
      frame: inline(inputs.frame?.value), fit: inline(inputs.fit?.value), sample: inline(inputs.sample?.value), spec: inline(inputs.spec?.value),
    })) }, needs: {} }) },
  ],
};
