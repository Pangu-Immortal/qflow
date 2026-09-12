import { projectTimelineMedia } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";
import type { ContentFit } from "@qflow/spatial";
import { appendTimedMediaLayer, createMediaLayerSet } from "@qflow/media-track";
import { appendMediaItem } from "@qflow/media-track";
import type { MediaSampleLayerSpec } from "@qflow/media-track";

type ItemArguments = Parameters<typeof appendMediaItem>;
type PerformanceInput = {
  set: ItemArguments[0]; header: ItemArguments[1]; timeline: ItemArguments[2]; canvas: ItemArguments[3];
  layers: ItemArguments[4]; frame: ItemArguments[5]; spec: ItemArguments[6];
  sounds: ItemArguments[7]; window: ItemArguments[8];
};

/** One framed unit and lifecycle containing all selected performance spans. */
export function appendMediaPerformance(input: PerformanceInput, fit: ContentFit, sample: MediaSampleLayerSpec) {
  const layers = [...input.layers.layers];
  for (const clip of projectTimelineMedia(input.timeline, input.window.span)) {
    if (clip.media.visual === undefined) continue;
    const [layer] = appendTimedMediaLayer(createMediaLayerSet(), clip.media, fit, {
      ...sample, id: `${input.spec.id}:${clip.segmentId}`, trim: clip.source, occupancy: { mode: "once", align: "start" },
    }).layers;
    if (layer?.kind !== "sample") throw new Error("Performance media did not produce a sample.");
    layers.push({ ...layer, sampling: {
      sourceFrameRate: clip.media.timeline.frameRate,
      sourceFrameCount: clip.media.timeline.frameCount,
      segments: [{ target: {
        startFrame: clip.span.startFrame - input.window.span.startFrame,
        endFrameExclusive: clip.span.endFrameExclusive - input.window.span.startFrame,
      }, sourceFrame: { numerator: clip.source.startFrame, denominator: 1 }, rate: { numerator: 1, denominator: 1 } }],
    } });
  }
  if (layers.length === 0) return input.set;
  return appendMediaItem(input.set, input.header, input.timeline, input.canvas, { layers }, input.frame,
    input.spec, input.sounds, input.window);
}
