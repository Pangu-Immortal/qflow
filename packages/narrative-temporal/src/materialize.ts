import type { Narrative, NarrativeExcerpt } from "@qflow/narrative";
import { assertLocalTemporalDomain } from "@qflow/temporal";
import type { LocalTemporalDomain } from "@qflow/temporal";

import { sealNarrativeAlignment } from "./identity.js";
import type { NarrativeAlignment } from "./types.js";

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

export function materializeSegmentBoundaryAlignment(
  narrative: Narrative,
  excerpt: NarrativeExcerpt,
  domain: LocalTemporalDomain,
): NarrativeAlignment {
  assertLocalTemporalDomain(domain);
  const segment = authoredSegment(narrative, excerpt);
  if (segment.tokenStart !== segment.tokenEndExclusive) throw new Error(`Segment ${segment.id} contains Tokens and needs timing.`);
  return sealNarrativeAlignment({
    narrativeId: narrative.id,
    domainId: domain.id,
    segment: { segmentId: segment.id, startBoundaryId: segment.startAnchorId, endBoundaryId: segment.endAnchorId },
    tokens: [],
    boundaries: [
      { id: segment.startAnchorId, frame: 0 },
      { id: segment.endAnchorId, frame: domain.frameCount },
    ],
  }, domain);
}
