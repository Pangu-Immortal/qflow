import type {
  Narrative,
  NarrativeSegmentRef,
  NarrativeMomentRef,
  NarrativeSelectionRef,
} from "./types.js";

function nonempty(value: string, subject: string): void {
  if (value.trim().length === 0) throw new Error(`${subject} must not be empty.`);
}

function unique(values: readonly string[], subject: string): Set<string> {
  const found = new Set<string>();
  for (const value of values) {
    nonempty(value, subject);
    if (found.has(value)) throw new Error(`${subject} repeats ${value}.`);
    found.add(value);
  }
  return found;
}

export function assertNarrativeIdentity(value: Narrative): void {
  nonempty(value.id, "Narrative id");
  if (value.segments.length === 0) throw new Error("Narrative must contain at least one Segment.");
  const segmentIds = unique(value.segments.map((item) => item.id), "Narrative Segment id");
  const tokenIds = unique(value.tokens.map((item) => item.id), "Narrative Token id");
  unique(value.turns.map((item) => item.id), "Narrative Turn id");
  unique(value.selections.map((item) => item.id), "Narrative Selection id");
  unique(value.moments.map((item) => item.id), "Narrative Moment id");
  const anchorIds = unique(value.anchors.map((item) => item.id), "Narrative Anchor id");
  const anchors = value.anchors;
  const anchorOrder = new Map(anchors.map((anchor, index) => [anchor.id, index] as const));
  let anchorCursor = 0;
  let tokenCursor = 0;
  for (const segment of value.segments) {
    if (!Number.isSafeInteger(segment.tokenStart) || !Number.isSafeInteger(segment.tokenEndExclusive)
      || segment.tokenStart !== tokenCursor || segment.tokenEndExclusive < segment.tokenStart
      || segment.tokenEndExclusive > value.tokens.length
      || !anchorIds.has(segment.startAnchorId) || !anchorIds.has(segment.endAnchorId)) {
      throw new Error(`Narrative Segment ${segment.id} has invalid token or Anchor boundaries.`);
    }
    const segmentStart = anchors[anchorCursor++];
    if (segmentStart?.id !== segment.startAnchorId || segmentStart.kind !== "segment-start"
      || segmentStart.segmentId !== segment.id) {
      throw new Error(`Narrative Segment ${segment.id} has no ordered start Anchor.`);
    }
    for (let index = segment.tokenStart; index < segment.tokenEndExclusive; index += 1) {
      const token = value.tokens[index]!;
      if (token.segmentId !== segment.id || !tokenIds.has(token.id)
        || !anchorIds.has(token.startAnchorId) || !anchorIds.has(token.endAnchorId)
        || token.text.length === 0 || token.normalized.length === 0) {
        throw new Error(`Narrative Token ${token.id} disagrees with Segment ${segment.id}.`);
      }
      const start = anchors[anchorCursor++];
      const end = anchors[anchorCursor++];
      if (start?.id !== token.startAnchorId || start.kind !== "token-start"
        || start.segmentId !== segment.id || start.tokenId !== token.id
        || end?.id !== token.endAnchorId || end.kind !== "token-end"
        || end.segmentId !== segment.id || end.tokenId !== token.id) {
        throw new Error(`Narrative Token ${token.id} has no ordered Anchor pair.`);
      }
    }
    const segmentEnd = anchors[anchorCursor++];
    if (segmentEnd?.id !== segment.endAnchorId || segmentEnd.kind !== "segment-end"
      || segmentEnd.segmentId !== segment.id) {
      throw new Error(`Narrative Segment ${segment.id} has no ordered end Anchor.`);
    }
    tokenCursor = segment.tokenEndExclusive;
  }
  if (tokenCursor !== value.tokens.length) throw new Error("Narrative Segments must partition Tokens in order.");
  if (anchorCursor !== anchors.length) {
    throw new Error("Narrative semantic anchors must be exactly the Segment and Token boundaries.");
  }
  for (const turn of value.turns) {
    if (!segmentIds.has(turn.segmentId) || !Number.isSafeInteger(turn.tokenStart)
      || !Number.isSafeInteger(turn.tokenEndExclusive) || turn.tokenEndExclusive <= turn.tokenStart
      || turn.tokenStart < 0 || turn.tokenEndExclusive > value.tokens.length
      || value.tokens.slice(turn.tokenStart, turn.tokenEndExclusive).some((token) => token.segmentId !== turn.segmentId)) {
      throw new Error(`Narrative Turn ${turn.id} has invalid Token coverage.`);
    }
  }
  for (const selection of value.selections) {
    const start = anchorOrder.get(selection.startAnchorId);
    const end = anchorOrder.get(selection.endAnchorId);
    if (start === undefined || end === undefined || end < start) {
      throw new Error(`Narrative Selection ${selection.id} has invalid Anchor order.`);
    }
  }
  for (const moment of value.moments) {
    if (!anchorIds.has(moment.anchorId)) throw new Error(`Narrative Moment ${moment.id} names an unknown Anchor.`);
  }
}

export function assertNarrativeSegmentRefIdentity(value: NarrativeSegmentRef): void {
  if (value.kind !== "segment") throw new Error("NarrativeSegmentRef must be a Segment.");
  nonempty(value.narrativeId, "NarrativeSegmentRef narrativeId");
  nonempty(value.id, "NarrativeSegmentRef id");
  if (!Number.isSafeInteger(value.tokenStart) || !Number.isSafeInteger(value.tokenEndExclusive)
    || value.tokenStart < 0 || value.tokenEndExclusive < value.tokenStart) {
    throw new Error("NarrativeSegmentRef Token coverage is invalid.");
  }
}

export function assertNarrativeSelectionRefIdentity(value: NarrativeSelectionRef): void {
  nonempty(value.narrativeId, "NarrativeSelection narrativeId");
  nonempty(value.id, "NarrativeSelection id");
  nonempty(value.startAnchorId, "NarrativeSelection startAnchorId");
  nonempty(value.endAnchorId, "NarrativeSelection endAnchorId");
}

export function assertNarrativeMomentRefIdentity(value: NarrativeMomentRef): void {
  nonempty(value.narrativeId, "NarrativeMoment narrativeId");
  nonempty(value.id, "NarrativeMoment id");
  nonempty(value.anchorId, "NarrativeMoment anchorId");
}
