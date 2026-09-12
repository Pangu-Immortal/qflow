import { sealVisualTrack, assertVisualTrackIdentity } from "@qflow/composition";
import type { FrameSpan, VisualTrack } from "@qflow/composition";
import { assertTemporalWindowFor } from "@qflow/temporal";
import type { TemporalWindow } from "@qflow/temporal";
import type { Timeline } from "@qflow/timeline";
import { VISUAL_IR_V1 } from "@qflow/visual-ir";

export type PerformanceUse = { readonly window: TemporalWindow; readonly visual: VisualTrack };
export type PerformanceSet = { readonly uses: readonly PerformanceUse[] };

export function appendPerformanceUse(set: PerformanceSet, window: TemporalWindow, visual: VisualTrack): PerformanceSet {
  assertVisualTrackIdentity(visual);
  if (visual.programSpaceId !== window.start.source.spaceId) throw new Error("Performance Use and picture belong to different Timelines.");
  return { uses: [...set.uses, { window, visual }] };
}

export function intersectVisibility(left: readonly FrameSpan[], right: readonly FrameSpan[]): FrameSpan[] {
  return left.flatMap(a => right.flatMap(b => {
    const startFrame = Math.max(a.startFrame, b.startFrame), endFrameExclusive = Math.min(a.endFrameExclusive, b.endFrameExclusive);
    return endFrameExclusive > startFrame ? [{ startFrame, endFrameExclusive }] : [];
  }));
}

export function performancePresentId(useId: string, presentId: string): string {
  return `${useId}:${presentId}`;
}

/** Keep original animation/sample origins. Only the visibility mask changes. */
export function resolvePerformance(timeline: Timeline, id: string, set: PerformanceSet): VisualTrack {
  const presents: VisualTrack["presents"][number][] = [];
  for (const [index, use] of set.uses.entries()) {
    assertTemporalWindowFor(use.window, { subjectId: use.window.subjectId, space: timeline });
    if (use.visual.programSpaceId !== timeline.id || use.window.start.source.spaceId !== timeline.id) throw new Error("Performance uses another Timeline.");
    let visible = [use.window.span];
    for (const later of set.uses.slice(index + 1)) {
      visible = visible.flatMap(span => {
        const cut = later.window.span;
        if (cut.endFrameExclusive <= span.startFrame || cut.startFrame >= span.endFrameExclusive) return [span];
        return [
          ...(cut.startFrame > span.startFrame ? [{ startFrame: span.startFrame, endFrameExclusive: cut.startFrame }] : []),
          ...(cut.endFrameExclusive < span.endFrameExclusive ? [{ startFrame: cut.endFrameExclusive, endFrameExclusive: span.endFrameExclusive }] : []),
        ];
      });
    }
    for (const present of use.visual.presents) {
      const visibility = intersectVisibility(visible, present.visibility ?? [present.span]);
      if (visibility.length) presents.push({ ...present, id: performancePresentId(use.window.subjectId, present.id), visibility });
    }
  }
  return sealVisualTrack({ id, programSpaceId: timeline.id, visualIr: VISUAL_IR_V1, presents });
}
