import { programSpaceTypes } from "@qflow/program-space";
import assert from "node:assert/strict";
import test from "node:test";
import { fixtureResource } from "../../../test/fixture-resource.js";

import type { StructuredElement, SurfaceResolvedReference } from "@qflow/markup";
import type { SemanticTake } from "@qflow/speech";
import { speechTypes } from "@qflow/speech";
import { decodeTimelineAuthorSurface } from "@qflow/timeline-author";

const take: SemanticTake = {
  narrativeId: "test-narrative",
  media: {
    timeline: { frameRate: { numerator: 30, denominator: 1 }, frameCount: 30 },
    visual: {
      artifact: { kind: "blob", resource: fixtureResource("track:take:video"), size: 1, mediaType: "video/mp4" },
      width: 720,
      height: 1280,
    },
    audio: {
      artifact: { kind: "blob", resource: fixtureResource("track:take:audio"), size: 1, mediaType: "audio/wav" },
    },
  },
  segment: {
    segmentId: "opening",
    startAnchorId: "opening:start",
    endAnchorId: "opening:end",
    startFrame: 0,
    endFrameExclusive: 30,
  },
  tokens: [],
  anchors: [
    { identity: "opening:start", frame: 0 },
    { identity: "opening:end", frame: 30 },
  ],
};

function resolved(path: string): SurfaceResolvedReference | undefined {
  if (path === "clock") return { path, type: programSpaceTypes.clock, ref: { kind: "record", id: path } };
  if (path === "opening.take") return {
    path,
    ref: { kind: "record", id: path },
    type: speechTypes.semanticTake,
    record: { id: path, type: speechTypes.semanticTake, value: { kind: "inline", value: take } },
  };
  return undefined;
}

test("Timeline accepts only already-semantic Segment Takes", async () => {
  const element: StructuredElement = {
    kind: "element",
    name: "time:Timeline",
    attributes: { id: "speech", clock: { kind: "reference", path: "clock" } },
    children: [{ kind: "element", name: "time:Take",
      attributes: { source: { kind: "reference", path: "opening.take" } }, children: [], range: { start: 20, end: 60 } }],
    range: { start: 0, end: 70 },
  };
  const output = await decodeTimelineAuthorSurface({
    sourceName: "main.svml",
    element,
    resolveReference: resolved,
    resolveAsset() { throw new Error("Timeline does not resolve assets"); },
  });
  assert.deepEqual(output.components[0]?.outputs, {
    timeline: "speech.timeline",
  });
  assert.deepEqual(output.exports, ["speech.timeline"]);
  assert.deepEqual(output.fragments?.[0]?.exports.map(port => port.name), ["timeline"]);
  assert.equal(output.records.length, 1);
  assert.deepEqual(output.fragments?.[0]?.inputs.map(input => input.name), ["clock", "header", "take-1"]);
});
