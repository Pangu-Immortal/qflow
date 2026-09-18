import assert from "node:assert/strict";
import test from "node:test";
import { decodeScriptSurface, parseScript, captionDocument } from "@qflow/script";
import { scriptStudioCompanions } from "../src/index.js";

test("Studio observes and edits the compiler's Script body without changing its prose", () => {
  const companion = scriptStudioCompanions[0]!;
  const body = '<line><host>是的  就是这样。 <진행자>@{beat!}“안녕”{emphasis} 세계. \\<!-- 설명</line>';
  const prefix = '<svml>\r\n<!-- 🎬 -->\r\n<script id="story">';
  const source = `${prefix}${body}</script>\r\n</svml>`;
  const input = { sourceName: "studio.svml", source, tag: "script", attributes: { id: "story" },
    openingStart: source.indexOf('<script'), contentStart: prefix.length };
  const decoded = decodeScriptSurface(input);
  const observed = companion.observe({ ...input, nextOffset: decoded.nextOffset })!;
  assert.equal(source.slice(observed.content.start, observed.content.end), body);
  assert.equal(source.slice(observed.moments[0]!.range.start, observed.moments[0]!.range.end), '@{beat!}');

  const parsed = parseScript("body", body);
  const anchorId = parsed.tokens[0]!.startAnchorId;
  const changed = companion.adjust({ sourceName: "body", source: body,
    adjustment: { kind: "moment", id: "beat", anchorId } });
  const after = parseScript("body", changed);
  assert.equal(after.moments[0]!.anchorId, anchorId);
  assert.equal(changed.replace('@{beat!}', ''), body.replace('@{beat!}', ''));
  assert.equal(after.serializations.speech, parsed.serializations.speech);
  assert.deepEqual(captionDocument(after, "caption", "story"), captionDocument(parsed, "caption", "story"));

  const projection = companion.project!({ source: { ...observed, companion: companion.id },
    values: decoded.records.flatMap(record => record.value.kind === "inline"
      ? [{ id: record.id, type: record.type, value: record.value.value }] : []),
    anchors: new Map(parsed.semanticIndex.anchors.map((anchor, index) => [anchor.id, index * 3])),
  });
  assert.deepEqual(projection.tokens.map(token => token.text), parsed.tokens.map(token => token.text));
  assert.deepEqual(projection.tokens.map(token => token.range), observed.tokens.map(token => token.range));
});
