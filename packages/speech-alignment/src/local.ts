import type { Narrative, NarrativeExcerpt } from "@qflow/narrative";
import type { NarrativeAlignment } from "@qflow/narrative-temporal";
import type { AlignedTranscriptEvidence } from "@qflow/speech-evidence";
import type { LocalTemporalDomain } from "@qflow/temporal";

import { locateAlignedSegmentTiming } from "./locate.js";
import { materializeNarrativeAlignment } from "./materialize.js";
import type { AlignmentBasis } from "./locate.js";

function segmentNarrative(narrative: Narrative, excerpt: NarrativeExcerpt): Narrative {
  if (excerpt.kind !== "segment") throw new Error("Narrative alignment requires a Segment excerpt.");
  const segment = narrative.segments.find((candidate) => candidate.id === excerpt.id);
  if (segment === undefined) throw new Error(`Narrative does not contain Segment ${excerpt.id}.`);
  if (excerpt.tokenStart !== segment.tokenStart || excerpt.tokenEndExclusive !== segment.tokenEndExclusive) {
    throw new Error(`NarrativeExcerpt ${excerpt.id} does not describe its authored Segment.`);
  }
  const tokens = narrative.tokens.slice(segment.tokenStart, segment.tokenEndExclusive);
  return {
    id: narrative.id,
    segments: [{ ...segment, tokenStart: 0, tokenEndExclusive: tokens.length }],
    tokens,
    turns: narrative.turns.filter((turn) => turn.segmentId === segment.id).map((turn) => ({ ...turn,
      tokenStart: turn.tokenStart - segment.tokenStart, tokenEndExclusive: turn.tokenEndExclusive - segment.tokenStart })),
    selections: [], moments: [],
    semanticIndex: { anchors: narrative.semanticIndex.anchors.filter((anchor) => anchor.segmentId === segment.id) },
  };
}

/** Align one normalized source locally without turning media into a semantic aggregate. */
export function alignNarrative(
  narrative: Narrative,
  excerpt: NarrativeExcerpt,
  domain: LocalTemporalDomain,
  evidence: AlignedTranscriptEvidence,
): NarrativeAlignment {
  const localNarrative = segmentNarrative(narrative, excerpt);
  if (evidence.domainId !== domain.id) {
    throw new Error(`Narrative alignment ${excerpt.id} evidence belongs to another local domain.`);
  }
  const basis: AlignmentBasis = {
    domainId: domain.id,
    frameDomain: { frameRate: domain.frameRate, frameCount: domain.frameCount },
    segments: [{ segmentId: excerpt.id, startFrame: 0, endFrameExclusive: domain.frameCount }],
  };
  const timing = locateAlignedSegmentTiming(localNarrative, basis, evidence);
  return materializeNarrativeAlignment(localNarrative, {
    ...excerpt, tokenStart: 0, tokenEndExclusive: localNarrative.tokens.length,
  }, domain, timing);
}
