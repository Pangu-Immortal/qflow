import assert from "node:assert/strict";
import test from "node:test";
import { adjustScriptMoment, adjustScriptSelection, captionDocument, narrativeValue, parseScript } from "@qflow/script";

const fixtures = [
  '<one><HOST>“Hello,” world{emphasis}! @{beat!}</one>',
  '<one><HOST>你好，世界！@{beat!}</one>',
  '<one><HOST>用<Qflow|Hai Pit>做视频 || 很好。@{beat!}</one>',
  '<one/>\r\n<two><HOST>Hello. @{beat!}</two>',
  '<one>  <HOST>first    @{beat!}   second.\n  <GUEST>Third.</one><two></two>',
  '<one>A\n\t  @{~beat!}  B  .</one>',
  '\t <one>\r\n\t  <HOST>We are\r\n\t  @{beat!}  talking about Instagram  .\r\n\t  </one>\r\n',
  '<one>\n  @{beat!}  \n  <HOST>你 好 ，世 界 ！\n</one>',
  '<one><!-- keep   this\n\t comment --> <HOST>用<Qflow|Hai  Pit>  做 视频{emphasis}  。@{beat!}</one>',
  '<one>Find \\@qflow now. @{beat!}</one>',
  '<one>Use \\{braces\\} here. @{beat!}</one>',
  '<one><Qflow|Hai \\@ Pit> works. @{beat!}</one>',
  '<one><HOST>把<动效|><组件化|>。@{beat!}</one>',
  '<one><HOST><Git Hub|> <图{emphasis}像|> <\\@Qflow|>。@{beat!}</one>',
];

for (const source of fixtures) test(`Moment round trips through structural and lexical anchors: ${source}`, () => {
  const original = parseScript("edit", source);
  const move = (text: string, anchorId: string) => adjustScriptMoment({
    sourceName: "edit", source: text, parsed: parseScript("edit", text), adjustment: { id: "beat", anchorId },
  });
  for (const anchor of original.semanticIndex.anchors) {
    const first = move(source, anchor.id);
    const back = move(first, original.moments[0]!.anchorId);
    assert.deepEqual(narrativeValue(parseScript("edit", back), "story"), narrativeValue(original, "story"));
    assert.deepEqual(captionDocument(parseScript("edit", back), "caption", "story"), captionDocument(original, "caption", "story"));
    // A second visit uses exactly the same spelling; spacing cannot accumulate.
    assert.equal(move(back, anchor.id), first);
  }
});

test("moving a marker preserves every source whitespace character without accumulating residue", () => {
  const source = '<one>\r\n\t  <HOST>We are\r\n\t  @{beat!}  on   Instagram   .  \r\n\t  </one>';
  const original = parseScript("edit", source);
  const originalAnchor = original.moments[0]!.anchorId;
  const end = original.tokens.at(-1)!.endAnchorId;
  const move = (text: string, anchorId: string) => adjustScriptMoment({
    sourceName: "edit", source: text, parsed: parseScript("edit", text), adjustment: { id: "beat", anchorId },
  });
  const atEnd = move(source, end);
  assert.equal(atEnd, '<one>\r\n\t  <HOST>We are\r\n\t    on   Instagram@{~beat!}   .  \r\n\t  </one>');
  let current = atEnd;
  for (let index = 0; index < 30; index++) {
    current = move(move(current, originalAnchor), end);
    assert.equal(current, atEnd);
  }
  assert.equal(move(atEnd, end), atEnd);
});

test("an unchanged Selection leaves its source formatting untouched", () => {
  const sources = [
    '<one><HOST>@{social} on   Instagram @{/social} .</one>',
    '<one><HOST>@{social} on Instagram.@{/social}</one>',
  ];
  const normalized = sources.map(source => {
    const parsed = parseScript("edit", source);
    const selection = parsed.selections[0]!;
    return adjustScriptSelection({ sourceName: "edit", source, parsed, adjustment: selection });
  });
  assert.deepEqual(normalized, sources);
});

test("Selection endpoints sharing a source position are written together in semantic order", () => {
  const source = '<one><HOST>@{range} hello @{/range} world.</one><empty/>';
  const original = parseScript("edit", source);
  const anchors = original.semanticIndex.anchors;
  for (let start = 0; start < anchors.length; start++) for (let end = start; end < anchors.length; end++) {
    const adjustment = { id: "range", startAnchorId: anchors[start]!.id, endAnchorId: anchors[end]!.id };
    const next = adjustScriptSelection({ sourceName: "edit", source, parsed: original, adjustment });
    const parsed = parseScript("edit", next);
    assert.equal(parsed.selections[0]!.startAnchorId, adjustment.startAnchorId);
    assert.equal(parsed.selections[0]!.endAnchorId, adjustment.endAnchorId);
  }
});

for (const source of [
  '<one>A   @{s} B  . @{/s}</one>',
  '<one>A   @{~s} B  . @{/s}</one>',
  '<one>@{s} A   @{/s} B  .</one>',
  '<one>@{s} A   @{/s~} B  .</one>',
  '<one><HOST>@{s} <动效|><组件化|> @{/s}</one>',
]) test(`Selection affinity survives every structural round trip: ${source}`, () => {
  const original = parseScript("edit", source);
  const selection = original.selections[0]!;
  const move = (text: string, startAnchorId: string, endAnchorId: string) => adjustScriptSelection({
    sourceName: "edit", source: text, parsed: parseScript("edit", text),
    adjustment: { id: selection.id, startAnchorId, endAnchorId },
  });
  const expected = move(source, selection.startAnchorId, selection.endAnchorId);
  const anchors = original.semanticIndex.anchors;
  for (let start = 0; start < anchors.length; start++) for (let end = start; end < anchors.length; end++) {
    const moved = move(expected, anchors[start]!.id, anchors[end]!.id);
    const actual = parseScript("edit", moved).selections[0]!;
    assert.equal(actual.startAnchorId, anchors[start]!.id);
    assert.equal(actual.endAnchorId, anchors[end]!.id);
    const back = move(moved, selection.startAnchorId, selection.endAnchorId);
    assert.deepEqual(narrativeValue(parseScript("edit", back), "story"), narrativeValue(original, "story"));
    assert.equal(back.replace(/@\{[^{}]+\}/gu, ""), expected.replace(/@\{[^{}]+\}/gu, ""));
  }
});

test("Moving one relationship preserves crossing selections, cues and other moments", () => {
  const source = '<one><HOST>@{a} One @{b} two @{/a} || three @{/b}. @{beat!} @{~other!}</one>';
  const parsed = parseScript("edit", source);
  const next = adjustScriptMoment({ sourceName: "edit", source, parsed,
    adjustment: { id: "beat", anchorId: parsed.tokens[0]!.endAnchorId } });
  const result = parseScript("edit", next);
  assert.deepEqual(result.selections.map(({ id, startAnchorId, endAnchorId }) => ({ id, startAnchorId, endAnchorId })),
    parsed.selections.map(({ id, startAnchorId, endAnchorId }) => ({ id, startAnchorId, endAnchorId })));
  assert.equal(result.moments.find((item) => item.id === "other")!.anchorId,
    parsed.moments.find((item) => item.id === "other")!.anchorId);
});
