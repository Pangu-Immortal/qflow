import { timelineSampleFrames, sealTimeline } from "@qflow/timeline";
import {
  assertSpeechEvidenceAudioIdentity,
  sealSpeechEvidenceAudio,
  speechEvidenceSampleBoundary,
} from "@qflow/speech-evidence";
import assert from "node:assert/strict";
import test from "node:test";
import { fixtureResource } from "../../../test/fixture-resource.js";

test("speech evidence uses integer rational boundary projection rather than floating duration arithmetic", () => {
  assert.equal(speechEvidenceSampleBoundary(0), 0);
  assert.equal(speechEvidenceSampleBoundary(480_000), 160_000);
  assert.equal(speechEvidenceSampleBoundary(480_001), 160_000);
  assert.equal(speechEvidenceSampleBoundary(480_002), 160_001);
  const ntsc = sealTimeline({ id: "test-space", frameCount: 30, frameRate: { numerator: 30_000, denominator: 1_001 } });
  assert.equal(timelineSampleFrames(ntsc, 48_000), 48_048);
});

test("SpeechEvidenceAudio identifies its source domain and exact sample span", () => {
  const value = sealSpeechEvidenceAudio({
    domainId: "speech-domain",
    artifact: {
      kind: "blob",
      resource: fixtureResource("evidence"),
      size: 32_044,
      mediaType: "audio/wav",
    },
    sampleFrames: 16_000,
  });
  assert.doesNotThrow(() => assertSpeechEvidenceAudioIdentity(value));
  assert.throws(() => assertSpeechEvidenceAudioIdentity({ ...value, domainId: "" }), /identity/u);
  assert.throws(() => assertSpeechEvidenceAudioIdentity({ ...value, sampleFrames: 0 }), /identity/u);
});
