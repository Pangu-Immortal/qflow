import assert from "node:assert/strict";
import test from "node:test";

import { canonicalize } from "@qflow/protocol";
import {
  assertCaptionProgramForDocument,
  captionUnitsForRole,
  captionUnitsForSelection,
  sealCaptionStyle,
} from "@qflow/caption";
import { captionDocument, narrativeValue, parseScript } from "@qflow/script";
import type { Narrative } from "@qflow/narrative";

test("Caption uses complete semantic selections and authored cue breaks", () => {
  const parsed = parseScript("caption.svml", "<line>one @{focus} two three @{/focus} || four</line>");
  const narrative = narrativeValue(parsed, "story") as unknown as Narrative;
  const document = captionDocument(parsed, "story.caption", "story");
  const selection = narrative.selections[0]!;
  const subset = captionUnitsForSelection(narrative, selection);
  assert.equal(subset.unitIds.length, 2);
  assert.equal(document.cueBreaks.length, 1);
});

test("Caption selects complete Segments and the program through structural anchors", () => {
  const parsed = parseScript("caption-ranges.svml", `@{~whole}
@{opening} <intro><HOST>One idea.</intro> @{/opening}
<answer><GUEST>Another view.</answer>
@{/whole~}`);
  const narrative = narrativeValue(parsed, "story") as unknown as Narrative;
  const document = captionDocument(parsed, "story.caption", "story");
  const whole = narrative.selections.find((selection) => selection.id === "whole")!;
  const opening = narrative.selections.find((selection) => selection.id === "opening")!;
  assert.deepEqual(captionUnitsForSelection(narrative, whole).unitIds,
    document.units.map((unit) => unit.id));
  assert.deepEqual(captionUnitsForSelection(narrative, opening).unitIds,
    document.units.filter((unit) => unit.segmentId === "intro").map((unit) => unit.id));
});
