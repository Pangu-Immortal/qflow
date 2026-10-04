import type { Narrative, NarrativeExcerpt } from "@qflow/narrative";
import { sealNarrativeAlignment } from "@qflow/narrative-temporal";
import type { NarrativeAlignment } from "@qflow/narrative-temporal";
import { assertLocalTemporalDomain } from "@qflow/temporal";
import type { LocalTemporalDomain } from "@qflow/temporal";

import type { NarrativeAlignmentTiming } from "./types.js";

function authoredSegment(narrative: Narrative, excerpt: NarrativeExcerpt): Narrative["segments"][number] {
  if (narrative.id !== excerpt.narrativeId) throw new Error(`NarrativeExcerpt ${excerpt.id} belongs to another Narrative.`);
  if (excerpt.kind !== "segment") throw new Error("NarrativeAlignment materialization requires a Segment excerpt.");
  const segment = narrative.segments.find((candidate) => candidate.id === excerpt.id);
  if (segment === undefined) throw new Error(`Narrative does not contain Segment ${excerpt.id}.`);
  if (excerpt.tokenStart !== segment.tokenStart || excerpt.tokenEndExclusive !== segment.tokenEndExclusive) {
    throw new Error(`NarrativeExcerpt ${excerpt.id} does not describe its authored Segment.`);
  }
  return segment;
}

function localFrame(frame: number, domain: LocalTemporalDomain, label: string): number {
  if (!Number.isSafeInteger(frame) || frame < 0 || frame > domain.frameCount) {
    throw new Error(`${label} lies outside local domain ${domain.id}.`);
  }
  return frame;
}

export function materializeNarrativeAlignment(narrative: Narrative, excerpt: NarrativeExcerpt,
  domain: LocalTemporalDomain, timing: NarrativeAlignmentTiming): NarrativeAlignment {
  assertLocalTemporalDomain(domain);
  const segment = authoredSegment(narrative, excerpt);
  const timedById = new Map(timing.tokens.map((token) => [token.tokenId, token]));
  const tokens = narrative.tokens.slice(segment.tokenStart, segment.tokenEndExclusive).map((token) => {
    const timed = timedById.get(token.id);
    if (timed === undefined || timed.segmentId !== segment.id) throw new Error(`Semantic timing does not locate Token ${token.id}.`);
    const startFrame = localFrame(timed.startFrame, domain, `Token ${token.id}`);
    const endFrameExclusive = localFrame(timed.endFrameExclusive, domain, `Token ${token.id}`);
    if (endFrameExclusive <= startFrame) throw new Error(`Token ${token.id} has an empty or reversed frame window.`);
    return { tokenId: token.id, segmentId: segment.id, text: token.text,
      startBoundaryId: token.startAnchorId, endBoundaryId: token.endAnchorId };
  });
  const measuredById = new Map(timing.boundaries.map((boundary) => [boundary.id, boundary]));
  const boundaries = narrative.semanticIndex.anchors.filter((anchor) => anchor.segmentId === segment.id).map((anchor) => {
    const measured = measuredById.get(anchor.id);
    if (measured === undefined) throw new Error(`Semantic timing does not locate Boundary ${anchor.id}.`);
    return { id: anchor.id, frame: localFrame(measured.frame, domain, `Boundary ${anchor.id}`) };
  });
  return sealNarrativeAlignment({ narrativeId: narrative.id, domainId: domain.id,
    segment: { segmentId: segment.id, startBoundaryId: segment.startAnchorId, endBoundaryId: segment.endAnchorId },
    tokens, boundaries }, domain);
}
