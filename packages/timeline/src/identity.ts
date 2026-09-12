import { assertProgramSpaceIdentity, programSpaceFrameCount } from "@qflow/program-space";
import { assertSemanticTakeIdentity } from "@qflow/speech";

import type { Timeline, TimelineSpan } from "./types.js";

export function sealTimeline(value: Timeline): Timeline {
  const track = structuredClone(value);
  assertTimelineIdentity(track);
  return track;
}

export function assertTimelineIdentity(track: Timeline): void {
  assertProgramSpaceIdentity(track);
  const frameCount = programSpaceFrameCount(track);
  if (track.items.length > 0 && !track.narrativeId?.trim()) throw new Error("A Timeline with Takes requires their Narrative identity.");
  if (track.items.length === 0 && track.narrativeId !== undefined) throw new Error("An empty Timeline has no Narrative identity.");
  const segmentIds = new Set<string>();
  const tokenIds = new Set<string>();
  const anchorIds = new Set<string>();
  const frameRate = track.frameRate;
  for (const item of track.items) {
    assertSemanticTakeIdentity(item.take);
    if (!Number.isSafeInteger(item.startFrame) || item.startFrame < 0
      || item.startFrame + item.take.media.timeline.frameCount > frameCount) {
      throw new Error(`Timeline placement for ${item.take.segment.segmentId} is outside its Program range.`);
    }
    if (item.take.narrativeId !== track.narrativeId) {
      throw new Error(`Timeline ${track.id} mixes Narrative ${item.take.narrativeId} into ${track.narrativeId}.`);
    }
    const rate = item.take.media.timeline.frameRate;
    if (frameRate.numerator !== rate.numerator || frameRate.denominator !== rate.denominator) {
      throw new Error("Timeline items must use one frame rate.");
    }
    const segmentId = item.take.segment.segmentId;
    if (segmentIds.has(segmentId)) throw new Error(`Timeline repeats Segment ${segmentId}.`);
    segmentIds.add(segmentId);
    for (const token of item.take.tokens) {
      if (tokenIds.has(token.tokenId)) throw new Error(`Timeline repeats Token ${token.tokenId}.`);
      tokenIds.add(token.tokenId);
    }
    for (const anchor of item.take.anchors) {
      if (anchor.identity === "program:start" || anchor.identity === "program:end") {
        throw new Error(`SemanticTake cannot declare reserved Program Anchor ${anchor.identity}.`);
      }
      if (anchorIds.has(anchor.identity)) throw new Error(`Timeline repeats Anchor ${anchor.identity}.`);
      anchorIds.add(anchor.identity);
    }
  }
}

export function timelineSpans(track: Timeline): readonly TimelineSpan[] {
  assertTimelineIdentity(track);
  return track.items.map(item => ({ item, startFrame: item.startFrame,
    endFrameExclusive: item.startFrame + item.take.media.timeline.frameCount }));
}

export function timelineFrameCount(track: Timeline): number {
  assertTimelineIdentity(track);
  return programSpaceFrameCount(track);
}
