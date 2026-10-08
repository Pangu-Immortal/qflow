import assert from "node:assert/strict";
import test from "node:test";

import { assertCaptionDocumentIdentity, captionUnitsForRole } from "@qflow/caption";
import type { CaptionDocument } from "@qflow/caption";

const document: CaptionDocument = {
  id: "captions",
  words: [
    { id: "word-a", unitId: "unit-a", text: "Shown", separatorBefore: "", attributes: [] },
    { id: "word-b", unitId: "unit-a", text: "words", separatorBefore: " ", attributes: [] },
    { id: "word-c", unitId: "unit-b", text: "Next", separatorBefore: " ", attributes: [] },
  ],
  units: [
    { id: "unit-a", wordIds: ["word-a", "word-b"] },
    { id: "unit-b", wordIds: ["word-c"] },
  ],
  cues: [
    { id: "cue-a", unitIds: ["unit-a"], role: "HOST" },
    { id: "cue-b", unitIds: ["unit-b"], role: "GUEST" },
  ],
};

test("CaptionDocument partitions Words into Units and Units into authored Cues", () => {
  assert.doesNotThrow(() => assertCaptionDocumentIdentity(document));
  assert.deepEqual(captionUnitsForRole(document, "HOST"), {
    documentId: document.id,
    unitIds: ["unit-a"],
  });
  assert.throws(() => assertCaptionDocumentIdentity({
    ...document,
    cues: [{ id: "cue", unitIds: ["unit-b", "unit-a"] }],
  }), /Cues must partition units in order/u);
});
