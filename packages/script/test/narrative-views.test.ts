import assert from "node:assert/strict";
import test from "node:test";
import { decodeScriptSurface, narrativeValue, parseScript } from "@qflow/script";
import { assertNarrativeIdentity, narrativeAnchorTokenBoundary, narrativeSelectionTokenRange,
  narrativeTokensForSelection, narrativeTypes } from "@qflow/narrative";
import type { Narrative, NarrativeSelectionRef } from "@qflow/narrative";
import { captionUnitsForSelection, captionTypes, decodeHiddenCaptionStyleSurface, sealCaptionStyle } from "@qflow/caption";
import type { CaptionProgram } from "@qflow/caption";
import { parseStructuredElement } from "@qflow/markup";
import type { SurfaceResolvedReference } from "@qflow/markup";

const body = `<intro><HOST>Try @brand <qflow|Hai-Pit> @/brand today. ||</intro>
<gap/>
<closing><HOST>现在 @name <声工坊|voice workshop> @/name 好用。<|indeed></closing>`;

function authored() {
  return narrativeValue(parseScript("views.svml", body), "story") as unknown as Narrative;
}

test("Script exports complete author content and a caption view from that same value", () => {
  const source = `<script id="story">${body}</script>`;
  const result = decodeScriptSurface({ sourceName: "views.svml", source, tag: "script",
    attributes: { id: "story" }, openingStart: 0, contentStart: source.indexOf(">") + 1 });
  const root = result.records.find((record) => record.id === "story")!;
  const caption = result.records.find((record) => record.id === "story.caption")!;
  assert.equal(root.value.kind, "inline");
  assert.equal(caption.value.kind, "inline");
  if (root.value.kind !== "inline" || caption.value.kind !== "inline") return;
  const narrative = root.value.value as unknown as Narrative;
  assertNarrativeIdentity(narrative);
  assert.strictEqual(narrative.caption, caption.value.value);
  assert.match(narrative.caption.words.map((word) => word.text).join(""), /qflow/);
  assert.match(narrative.caption.words.map((word) => word.text).join(""), /声工坊/);
  assert.ok(!narrative.caption.words.some((word) => word.text.includes("indeed")));
  assert.ok(narrative.tokens.some((token) => token.text === "indeed"));
  assert.equal(narrative.caption.cueBreaks.length, 1);
});

test("Narrative selections query authored speech while Caption preserves display correspondence", () => {
  const narrative = authored();
  const brand = narrative.selections.find((selection) => selection.id === "brand")!;
  assert.equal(narrativeTokensForSelection(narrative, brand).map((token) => token.text).join(" "), "Hai-Pit");
  const name = narrative.selections.find((selection) => selection.id === "name")!;
  const selected = new Set(captionUnitsForSelection(narrative, name).unitIds);
  assert.equal(narrative.caption.words.filter((word) => selected.has(word.unitId)).map((word) => word.text).join(""), "声工坊");
  const unit = narrative.caption.units.find((unit) => selected.has(unit.id))!;
  const first = narrative.tokens.find((token) => token.id === unit.sourceTokenIds[0])!;
  const last = narrative.tokens.find((token) => token.id === unit.sourceTokenIds.at(-1))!;
  assert.notEqual(first.id, last.id);
  assert.throws(() => captionUnitsForSelection(narrative, {
    id: "partial", startAnchorId: first.endAnchorId, endAnchorId: last.endAnchorId,
  }), /partially selects/);
  const foreign: NarrativeSelectionRef = { ...brand, narrativeId: "other" };
  assert.throws(() => narrativeTokensForSelection(narrative, foreign), /another Narrative/);
});

test("Content queries preserve structural boundaries even when no words lie between them", () => {
  const narrative = authored();
  const gap = narrative.segments.find((segment) => segment.id === "gap")!;
  assert.deepEqual(narrativeTokensForSelection(narrative, { id: "gap", startAnchorId: gap.startAnchorId, endAnchorId: gap.endAnchorId }), []);
  assert.equal(narrativeAnchorTokenBoundary(narrative, gap.startAnchorId), narrativeAnchorTokenBoundary(narrative, gap.endAnchorId));
  assert.throws(() => narrativeSelectionTokenRange(narrative, { id: "backwards", startAnchorId: gap.endAnchorId, endAnchorId: gap.startAnchorId }), /anchor order/);
  assert.deepEqual(narrativeTokensForSelection(narrative, { id: "whole", startAnchorId: "program:start", endAnchorId: "program:end" }), narrative.tokens);
});
