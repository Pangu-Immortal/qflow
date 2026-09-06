import type { SynchronizedMedia } from "qflow/media";
import type { Narrative, NarrativeExcerpt } from "qflow/narrative";
import { materializeSemanticTake } from "qflow/speech";

// Expose this adapter through a project Producer/Surface with a take output.
export function wordlessTake(
  narrative: Narrative,
  excerpt: NarrativeExcerpt,
  media: SynchronizedMedia,
) {
  if (excerpt.kind !== "segment" || excerpt.tokenStart !== excerpt.tokenEndExclusive) {
    throw new Error("wordlessTake requires one Script Segment with no spoken Tokens.");
  }
  const segment = narrative.segments.find((item) => item.id === excerpt.id);
  if (segment === undefined) throw new Error(`Script Segment ${excerpt.id} is missing.`);
  return materializeSemanticTake(narrative, excerpt, media, {
    tokens: [],
    anchors: [
      { identity: segment.startAnchorId, frame: 0 },
      { identity: segment.endAnchorId, frame: media.timeline.frameCount },
    ],
  });
}
