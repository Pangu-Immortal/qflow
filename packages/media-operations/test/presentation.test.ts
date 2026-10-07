import assert from "node:assert/strict";
import test from "node:test";
import { mediaOperationsComponent } from "../src/component.js";
import { mediaOperationsProducers } from "../src/manifest.js";

test("audio range request describes its own range without listing every clip", () => {
  const facet = mediaOperationsComponent.plannedNeeds.find((item) => item.producer.name === mediaOperationsProducers.renderAudioRange.name)!;
  const plan = { frameRate: { numerator: 30, denominator: 1 }, frameCount: 600, sampleRate: 48000,
    clips: Array.from({ length: 35 }, () => ({ source: "not a CLI output" })) };
  assert.deepEqual(facet.present!({ constraints: {}, pendingInputs: [] }), { fields: {}, references: {} });
  assert.deepEqual(facet.present!({ constraints: { plan, range: { startFrame: 30, endFrameExclusive: 91 } }, pendingInputs: [] }), {
    fields: { startFrame: [30], endFrameExclusive: [91], frameRate: ["30/1"], sampleRate: [48000] }, references: {},
  });
});
