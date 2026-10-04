import assert from "node:assert/strict";
import test from "node:test";

import { parseStructuredElement } from "@qflow/markup";
import { temporalTypes } from "@qflow/temporal";
import { timelineTypes } from "@qflow/timeline";
import {
  decodeAbsoluteInstantSurface,
  decodeAbsoluteWindowSurface,
  decodeTimelineAuthorSurface,
  timelineAuthorMarkupSurfaces,
  timelineAuthorTypes,
} from "@qflow/timeline-author";

const absoluteReferences = new Map([
  ["film.timeline", { path: "film.timeline", type: timelineTypes.track, ref: { kind: "record" as const, id: "film.timeline" } }],
  ["reveal", { path: "reveal", type: temporalTypes.instant, ref: { kind: "record" as const, id: "reveal" } }],
  ["answer-end", { path: "answer-end", type: temporalTypes.instant, ref: { kind: "record" as const, id: "answer-end" } }],
]);

test("Timeline Surface publishes its range and every named Instant or Window", async () => {
  const source = `<time:Timeline id="film" clock={clock} end="latest(speech.end,outro.end)">
    <time:Window id="outro" from="private-cue" for="3s"/>
    <time:Window id="speech" from="start" for={voice.extent}/>
    <time:Instant id="private-cue" at="speech.end"/>
  </time:Timeline>`;
  const element = parseStructuredElement({ name: "timeline.svml", text: source }, 0).element;
  const references = new Map([
    ["clock", { path: "clock", type: timelineTypes.clock, ref: { kind: "record" as const, id: "clock" } }],
    ["voice.extent", { path: "voice.extent", type: temporalTypes.extent, ref: { kind: "record" as const, id: "voice.extent" } }],
  ]);
  const output = await decodeTimelineAuthorSurface({
    sourceName: "timeline.svml", element,
    resolveReference: (path) => references.get(path),
    resolveAsset: async () => { throw new Error("unused"); },
  });
  assert.deepEqual(output.exports, [
    "film.timeline", "film.window", "film.start", "film.end",
    "film.outro", "film.outro.start", "film.outro.end",
    "film.speech", "film.speech.start", "film.speech.end", "film.private-cue",
  ]);
  assert.equal(JSON.stringify(output.fragments).includes("speech.end"), false);
  assert.equal(JSON.stringify(output.fragments).includes("3s"), false);
});

test("Timeline Window requires exactly two of from, until and for", () => {
  const source = '<time:Timeline id="film" clock={clock} end="3s"><time:Window id="bad" from="start"/></time:Timeline>';
  const element = parseStructuredElement({ name: "timeline.svml", text: source }, 0).element;
  assert.throws(() => decodeTimelineAuthorSurface({
    sourceName: "timeline.svml", element,
    resolveReference: () => ({ path: "clock", type: timelineTypes.clock, ref: { kind: "record", id: "clock" } }),
    resolveAsset: async () => { throw new Error("unused"); },
  }), /exactly two/);
});

test("standalone Window publishes one reusable value and its boundaries", async () => {
  const element = parseStructuredElement({ name: "timeline.svml", text:
    '<time:Window id="reveal-band" timeline={film.timeline} from={reveal} until={answer-end}/>' }, 0).element;
  const output = await decodeAbsoluteWindowSurface({
    sourceName: "timeline.svml", element,
    resolveReference: (path) => absoluteReferences.get(path),
    resolveAsset: async () => { throw new Error("unused"); },
  });
  assert.deepEqual(output.exports, ["reveal-band", "reveal-band.start", "reveal-band.end"]);
  assert.deepEqual(output.components[0]?.outputs,
    { window: "reveal-band", start: "reveal-band.start", end: "reveal-band.end" });
  assert.equal(output.fragments[0]?.exports.find((port) => port.name === "window")?.type.name, "TemporalWindow");
  assert.equal(output.fragments[0]?.exports.filter((port) => port.type.name === "TemporalInstant").length, 2);
});

test("standalone Instant publishes an authored absolute point and does not alias another domain value", async () => {
  const literal = parseStructuredElement({ name: "timeline.svml", text:
    '<time:Instant id="credits" timeline={film.timeline} at="timeline.end-2s"/>' }, 0).element;
  const output = await decodeAbsoluteInstantSurface({
    sourceName: "timeline.svml", element: literal,
    resolveReference: (path) => absoluteReferences.get(path),
    resolveAsset: async () => { throw new Error("unused"); },
  });
  assert.deepEqual(output.exports, ["credits"]);
  assert.deepEqual(output.components[0]?.outputs, { instant: "credits" });

  const alias = parseStructuredElement({ name: "timeline.svml", text:
    '<time:Instant id="renamed" timeline={film.timeline} at={reveal}/>' }, 0).element;
  assert.throws(() => decodeAbsoluteInstantSurface({
    sourceName: "timeline.svml", element: alias,
    resolveReference: (path) => absoluteReferences.get(path),
    resolveAsset: async () => { throw new Error("unused"); },
  }), /reference an existing Instant directly/);
});
