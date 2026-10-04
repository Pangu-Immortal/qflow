import { assertLocalTemporalDomain } from "@qflow/temporal";
import type { LocalTemporalDomain } from "@qflow/temporal";

import type { NarrativeAlignment } from "./types.js";

export function sealNarrativeAlignment(value: NarrativeAlignment, domain?: LocalTemporalDomain): NarrativeAlignment {
  assertNarrativeAlignmentIdentity(value, domain);
  return structuredClone(value);
}

export function assertNarrativeAlignmentIdentity(alignment: NarrativeAlignment, domain?: LocalTemporalDomain): void {
  if (!alignment.narrativeId.trim() || !alignment.domainId.trim()) throw new Error("NarrativeAlignment identity is invalid.");
  if (domain !== undefined) {
    assertLocalTemporalDomain(domain);
    if (alignment.domainId !== domain.id) throw new Error("NarrativeAlignment belongs to another local domain.");
  }
  const frameCount = domain?.frameCount;
  const frames = new Map<string, number>();
  for (const boundary of alignment.boundaries) {
    if (!boundary.id || frames.has(boundary.id) || !Number.isSafeInteger(boundary.frame)
      || boundary.frame < 0 || (frameCount !== undefined && boundary.frame > frameCount)) {
      throw new Error(`NarrativeAlignment boundary ${boundary.id || "<unnamed>"} is invalid.`);
    }
    frames.set(boundary.id, boundary.frame);
  }
  const segment = alignment.segment;
  if (!segment.segmentId || !segment.startBoundaryId || !segment.endBoundaryId
    || frames.get(segment.startBoundaryId) === undefined || frames.get(segment.endBoundaryId) === undefined) {
    throw new Error("NarrativeAlignment Segment boundaries are invalid.");
  }
  if (domain !== undefined
    && (frames.get(segment.startBoundaryId) !== 0 || frames.get(segment.endBoundaryId) !== domain.frameCount)) {
    throw new Error("NarrativeAlignment Segment must cover its local domain.");
  }
  const tokenIds = new Set<string>();
  let previousStart = 0;
  let previousEnd = 0;
  for (const token of alignment.tokens) {
    const start = frames.get(token.startBoundaryId);
    const end = frames.get(token.endBoundaryId);
    if (!token.tokenId || tokenIds.has(token.tokenId) || token.segmentId !== segment.segmentId || !token.text
      || start === undefined || end === undefined || end <= start || start < previousStart || end < previousEnd) {
      throw new Error(`NarrativeAlignment Token ${token.tokenId || "<unnamed>"} is invalid.`);
    }
    tokenIds.add(token.tokenId);
    previousStart = start;
    previousEnd = end;
  }
}
