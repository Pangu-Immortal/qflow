import assert from "node:assert/strict";
import test from "node:test";

import { assertNarrativeAlignmentIdentity } from "@qflow/narrative-temporal";

const domain = { id: "speech-domain", frameRate: { numerator: 30, denominator: 1 }, frameCount: 30 };

test("NarrativeAlignment uses one canonical coordinate per named boundary", () => {
  const alignment = {
    narrativeId: "story", domainId: domain.id,
    segment: { segmentId: "intro", startBoundaryId: "intro:start", endBoundaryId: "intro:end" },
    tokens: [{ tokenId: "hello", segmentId: "intro", text: "hello", startBoundaryId: "hello:start", endBoundaryId: "hello:end" }],
    boundaries: [
      { id: "intro:start", frame: 0 }, { id: "hello:start", frame: 3 },
      { id: "hello:end", frame: 10 }, { id: "intro:end", frame: 30 },
    ],
  };
  assert.doesNotThrow(() => assertNarrativeAlignmentIdentity(alignment, domain));
  assert.throws(() => assertNarrativeAlignmentIdentity({ ...alignment,
    boundaries: [...alignment.boundaries, { id: "hello:start", frame: 4 }] }, domain), /boundary hello:start is invalid/u);
  assert.throws(() => assertNarrativeAlignmentIdentity({ ...alignment,
    boundaries: alignment.boundaries.filter((boundary) => boundary.id !== "hello:end") }, domain), /Token hello is invalid/u);
});
