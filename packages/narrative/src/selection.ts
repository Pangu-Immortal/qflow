import type { Narrative, NarrativeSelection, NarrativeSelectionRef, NarrativeToken } from "./types.js";

/** A range in authored token order, independent of material placement and frame timing. */
export type NarrativeTokenRange = {
  readonly narrativeId: string;
  readonly tokenStart: number;
  readonly tokenEndExclusive: number;
};

/** Resolve a semantic anchor to a boundary in the authored token sequence. */
export function narrativeAnchorTokenBoundary(narrative: Narrative, anchorId: string): number {
  const anchor = narrative.semanticIndex.anchors.find((item) => item.id === anchorId);
  if (anchor === undefined) throw new Error(`Narrative ${narrative.id} has no anchor ${anchorId}.`);
  if (anchor.kind === "program-start") return 0;
  if (anchor.kind === "program-end") return narrative.tokens.length;
  const segment = narrative.segments.find((item) => item.id === anchor.segmentId);
  if (segment === undefined) throw new Error(`Anchor ${anchorId} has no authored Segment.`);
  if (anchor.kind === "segment-start") return segment.tokenStart;
  if (anchor.kind === "segment-end") return segment.tokenEndExclusive;
  const index = narrative.tokens.findIndex((item) => item.id === anchor.tokenId);
  if (index < 0) throw new Error(`Anchor ${anchorId} has no authored token.`);
  return anchor.kind === "token-start" ? index : index + 1;
}

export function narrativeSelectionTokenRange(
  narrative: Narrative,
  selection: NarrativeSelection | NarrativeSelectionRef,
): NarrativeTokenRange {
  if ("narrativeId" in selection && selection.narrativeId !== narrative.id) {
    throw new Error(`Selection ${selection.id} belongs to another Narrative.`);
  }
  const anchors = narrative.semanticIndex.anchors;
  const start = anchors.findIndex((item) => item.id === selection.startAnchorId);
  const end = anchors.findIndex((item) => item.id === selection.endAnchorId);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`Selection ${selection.id} has invalid authored anchor order.`);
  }
  return {
    narrativeId: narrative.id,
    tokenStart: narrativeAnchorTokenBoundary(narrative, selection.startAnchorId),
    tokenEndExclusive: narrativeAnchorTokenBoundary(narrative, selection.endAnchorId),
  };
}

/** Select content without consulting a Timeline or reconstructing prose from token strings. */
export function narrativeTokensForSelection(
  narrative: Narrative,
  selection: NarrativeSelection | NarrativeSelectionRef,
): readonly NarrativeToken[] {
  const range = narrativeSelectionTokenRange(narrative, selection);
  return narrative.tokens.slice(range.tokenStart, range.tokenEndExclusive);
}
