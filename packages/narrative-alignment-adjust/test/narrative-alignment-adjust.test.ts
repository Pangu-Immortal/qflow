import assert from "node:assert/strict";
import test from "node:test";

import { adjustNarrativeAlignment } from "../src/program.js";

const domain = { id: "voice", frameRate: { numerator: 30, denominator: 1 }, frameCount: 90 };
const alignment = {
  narrativeId: "story",
  domainId: "voice",
  segment: { segmentId: "opening", startBoundaryId: "opening:start", endBoundaryId: "opening:end" },
  tokens: [{ tokenId: "hello", segmentId: "opening", text: "hello", startBoundaryId: "hello:start", endBoundaryId: "hello:end" }],
  boundaries: [
    { id: "opening:start", frame: 0 },
    { id: "hello:start", frame: 10 },
    { id: "hello:end", frame: 40 },
    { id: "opening:end", frame: 90 },
  ],
};

test("alignment correction changes one canonical boundary and no media", () => {
  const adjusted = adjustNarrativeAlignment(alignment, domain, {
    narrativeId: "story", boundaries: [{ boundaryId: "hello:end", frame: 45 }],
  });
  assert.equal(adjusted.boundaries.find((item) => item.id === "hello:end")?.frame, 45);
  assert.deepEqual(adjusted.tokens, alignment.tokens);
  assert.equal("media" in adjusted, false);
});

test("alignment correction rejects unknown and out-of-domain boundaries", () => {
  assert.throws(() => adjustNarrativeAlignment(alignment, domain, {
    narrativeId: "story", boundaries: [{ boundaryId: "missing", frame: 1 }],
  }), /does not contain/);
  assert.throws(() => adjustNarrativeAlignment(alignment, domain, {
    narrativeId: "story", boundaries: [{ boundaryId: "hello:end", frame: 91 }],
  }), /invalid adjusted frame/);
});
