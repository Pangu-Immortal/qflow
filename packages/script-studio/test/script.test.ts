import assert from "node:assert/strict";
import test from "node:test";
import { decodeScriptSurface, parseScript, captionDocument } from "@qflow/script";
import { narrativeTemporalTypes } from "@qflow/narrative-temporal";
import { scriptStudioTemporalDomains } from "../src/index.js";
import type { ScriptStudioObservation } from "../src/projection.js";

test("Studio observes and edits the compiler's Script body without changing its prose", () => {
  const companion = scriptStudioTemporalDomains[0]!;
  const body = '<line><host>是的  就是这样。 <진행자>@{beat!}“안녕”{emphasis} 세계. \\<!-- 설명</line>';
  const prefix = '<svml>\r\n<!-- 🎬 -->\r\n<script id="story">';
  const source = `${prefix}${body}</script>\r\n</svml>`;
  const input = { sourceName: "studio.svml", source, tag: "script", attributes: { id: "story" },
    openingStart: source.indexOf('<script'),
    range: { start: source.indexOf('<script'), end: source.length - "\r\n</svml>".length }, contentStart: prefix.length };
  const decoded = decodeScriptSurface(input);
  const observed = companion.observe({ ...input, nextOffset: decoded.nextOffset })!;
  assert.equal(source.slice(observed.content.start, observed.content.end), body);
  const observation = observed.data as ScriptStudioObservation;
  assert.equal(source.slice(observation.moments[0]!.range.start, observation.moments[0]!.range.end), '@{beat!}');

  const parsed = parseScript("body", body);
  const anchorId = parsed.tokens[0]!.startAnchorId;
  const changed = companion.adjust({ sourceName: "body", source: body,
    adjustment: { kind: "point", itemId: "beat", anchorId } });
  const after = parseScript("body", changed);
  assert.equal(after.moments[0]!.anchorId, anchorId);
  assert.equal(changed.replace('@{beat!}', ''), body.replace('@{beat!}', ''));
  assert.equal(after.serializations.speech, parsed.serializations.speech);
  assert.deepEqual(captionDocument(after, "caption", "story"), captionDocument(parsed, "caption", "story"));

  const values = decoded.records.flatMap(record => record.value.kind === "inline"
    ? [{ id: record.id, type: record.type, value: record.value.value }] : []);
  values.push({ id: "story.projection", type: narrativeTemporalTypes.narrativeProjection, value: {
    id: "story.projection", narrativeId: "story", timelineId: "film", segments: [], tokens: [],
    boundaries: parsed.anchors.map((anchor, index) => ({ id: anchor.id, frame: index * 3 })),
  } });
  const projection = companion.project({ source: { ...observed, companion: companion.id }, values,
    timeline: { id: "film", frameCount: 100, frameRate: { numerator: 30, denominator: 1 } },
  });
  assert.ok(projection);
  const tokens = projection.items.filter((item) => item.kind === "span" && item.appearance === "compact");
  assert.deepEqual(tokens.map(token => token.label), parsed.tokens.map(token => token.text));
  assert.deepEqual(tokens.map(token => token.range), observation.tokens.map(token => token.range));
});
