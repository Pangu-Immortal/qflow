import assert from "node:assert/strict";
import test from "node:test";
import { mediaPipelineComponent } from "../src/component.js";
import { mediaPipelineProducers } from "../src/manifest.js";

test("audio render presentation describes its own range without listing every clip", () => {
  const facet = mediaPipelineComponent.plannedNeeds.find((item) => item.producer.name === mediaPipelineProducers.renderAudioRange.name)!;
  const plan = { frameRate: { numerator: 30, denominator: 1 }, frameCount: 600, sampleRate: 48000,
    clips: Array.from({ length: 35 }, () => ({ source: "not a CLI output" })) };
  assert.deepEqual(facet.present!({ constraints: {}, pendingInputs: [] }), { fields: {}, references: {} });
  assert.deepEqual(facet.present!({ constraints: { plan, range: { startFrame: 30, endFrameExclusive: 91 } }, pendingInputs: [] }), {
    fields: { startFrame: [30], endFrameExclusive: [91], frameRate: ["30/1"], sampleRate: [48000] }, references: {},
  });
});
