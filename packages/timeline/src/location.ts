import type { NarrativeExcerpt, NarrativeMomentRef, NarrativeSelectionRef } from "@qflow/narrative";

import { assertTimelineIdentity, timelineFrameCount, timelineSpans } from "./identity.js";
import type { LocatedFrameSpan, Timeline } from "./types.js";

export function assertNarrativeSelectionIdentity(selection: NarrativeSelectionRef): void {
  if (!selection.narrativeId || !selection.id || !selection.startAnchorId || !selection.endAnchorId) throw new Error("NarrativeSelection is invalid");
}

export function assertNarrativeMomentIdentity(moment: NarrativeMomentRef): void {
  if (!moment.narrativeId || !moment.id || !moment.anchorId) throw new Error("NarrativeMoment is invalid");
}

function assertNarrativeOwner(track: Timeline, narrativeId: string, label: string): void {
  if (narrativeId !== track.narrativeId) {
    throw new Error(`${label} belongs to Narrative ${narrativeId}, not Timeline ${track.id}.`);
  }
}

export function semanticAnchorFrames(track: Timeline): ReadonlyMap<string, number> {
  assertTimelineIdentity(track);
  return new Map([
    ["program:start", 0] as const,
    ...timelineSpans(track).flatMap(({ item, startFrame }) =>
      item.take.anchors.map((anchor) => [anchor.identity, startFrame + anchor.frame] as const)),
    ["program:end", timelineFrameCount(track)] as const,
  ]);
}

function frameFor(frames: ReadonlyMap<string, number>, anchorId: string, owner: string): number {
  const frame = frames.get(anchorId);
  if (frame === undefined) throw new Error(`${owner} names Anchor ${anchorId}, which this Timeline does not contain.`);
  return frame;
}

export function selectionFrameSpan(
  track: Timeline,
  selection: NarrativeSelectionRef,
): LocatedFrameSpan {
  assertTimelineIdentity(track);
  assertNarrativeSelectionIdentity(selection);
  assertNarrativeOwner(track, selection.narrativeId, `NarrativeSelection ${selection.id}`);
  const frames = semanticAnchorFrames(track);
  return {
    startFrame: frameFor(frames, selection.startAnchorId, `NarrativeSelection ${selection.id}`),
    endFrameExclusive: frameFor(frames, selection.endAnchorId, `NarrativeSelection ${selection.id}`),
  };
}

export function segmentFrameSpan(track: Timeline, segment: NarrativeExcerpt): LocatedFrameSpan {
  assertTimelineIdentity(track);
  if (segment.kind !== "segment" || !segment.id) throw new Error("Narrative Segment excerpt is invalid");
  assertNarrativeOwner(track, segment.narrativeId, `Narrative Segment ${segment.id}`);
  const found = timelineSpans(track).find(({ item }) => item.take.segment.segmentId === segment.id);
  if (found === undefined) throw new Error(`Timeline does not contain Segment ${segment.id}.`);
  return { startFrame: found.startFrame, endFrameExclusive: found.endFrameExclusive };
}

export function tokenFrameSpan(track: Timeline, tokenIds: readonly string[]): LocatedFrameSpan | undefined {
  assertTimelineIdentity(track);
  if (tokenIds.length === 0) return undefined;
  const timing = new Map(timelineSpans(track).flatMap(({ item, startFrame }) =>
    item.take.tokens.map((token) => [token.tokenId, {
      startFrame: startFrame + token.startFrame,
      endFrameExclusive: startFrame + token.endFrameExclusive,
    }] as const)));
  const located = tokenIds.map((id) => timing.get(id));
  if (located.some((item) => item === undefined)) return undefined;
  return {
    startFrame: located[0]!.startFrame,
    endFrameExclusive: located.at(-1)!.endFrameExclusive,
  };
}

export function momentFrame(track: Timeline, moment: NarrativeMomentRef): number {
  assertTimelineIdentity(track);
  assertNarrativeMomentIdentity(moment);
  assertNarrativeOwner(track, moment.narrativeId, `NarrativeMoment ${moment.id}`);
  const frames = semanticAnchorFrames(track);
  return frameFor(frames, moment.anchorId, `NarrativeMoment ${moment.id}`);
}
