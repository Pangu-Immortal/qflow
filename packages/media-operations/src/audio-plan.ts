import { clockFrameSampleBoundary, timelineFrameCount, timelineFrameSampleBoundary } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";
import { assertAudioLevelAutomation, assertCompositionIdentity } from "@qflow/composition";
import type { Composition } from "@qflow/composition";
import { canonicalize, isResourceId } from "@qflow/qflow/protocol";

import type { AudioProgramPlan } from "./types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function exactInteger(value: { readonly numerator: number; readonly denominator: number }, label: string): number {
  assert(Number.isSafeInteger(value.numerator) && Number.isSafeInteger(value.denominator) && value.denominator > 0
    && value.numerator % value.denominator === 0, `${label} must resolve to an exact source-sample boundary`);
  const result = value.numerator / value.denominator;
  assert(Number.isSafeInteger(result) && result >= 0, `${label} is invalid`);
  return result;
}

function exactSourceEnd(sourceAtStart: { readonly numerator: number; readonly denominator: number },
  rate: { readonly numerator: number; readonly denominator: number }, targetLength: number, label: string): number {
  const numerator = BigInt(sourceAtStart.numerator) * BigInt(rate.denominator)
    + BigInt(targetLength) * BigInt(rate.numerator) * BigInt(sourceAtStart.denominator);
  const denominator = BigInt(sourceAtStart.denominator) * BigInt(rate.denominator);
  assert(numerator % denominator === 0n, `${label} must resolve to an exact source-sample boundary`);
  const result = numerator / denominator;
  assert(result >= 0n && result <= BigInt(Number.MAX_SAFE_INTEGER), `${label} is invalid`);
  return Number(result);
}

export function sealAudioProgramPlan(value: AudioProgramPlan): AudioProgramPlan {
  return canonicalize(value) as unknown as AudioProgramPlan;
}

export function verifyAudioProgramPlan(value: unknown): asserts value is AudioProgramPlan {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), "AudioProgramPlan must be an object");
  const item = value as AudioProgramPlan;
  assert(Number.isSafeInteger(item.frameRate?.numerator) && item.frameRate.numerator > 0
    && Number.isSafeInteger(item.frameRate?.denominator) && item.frameRate.denominator > 0,
  "AudioProgramPlan frame rate is invalid");
  assert(Number.isSafeInteger(item.frameCount) && item.frameCount > 0, "AudioProgramPlan frame count is invalid");
  assert(item.sampleRate === 48_000, "AudioProgramPlan sample rate must be 48000");
  assert(item.sampleFrames === clockFrameSampleBoundary({ frameRate: item.frameRate }, item.frameCount, 48_000),
    "AudioProgramPlan sample count differs from its frame domain");
  assert(Array.isArray(item.clips), "AudioProgramPlan clips are invalid");
  const ids = new Set<string>();
  for (const clip of item.clips) {
    assert(typeof clip.id === "string" && clip.id.length > 0 && !ids.has(clip.id),
      "AudioProgramPlan clip id is empty or repeated");
    ids.add(clip.id);
    assert(clip.artifact?.kind === "blob" && isResourceId(clip.artifact.resource)
      && Number.isSafeInteger(clip.artifact.size) && clip.artifact.size >= 0
      && clip.artifact.mediaType === "audio/wav",
    `AudioProgramPlan clip ${clip.id} must reference canonical WAV`);
    assert(Number.isSafeInteger(clip.targetStartSample) && clip.targetStartSample >= 0
      && Number.isSafeInteger(clip.targetEndSampleExclusive)
      && clip.targetEndSampleExclusive > clip.targetStartSample
      && clip.targetEndSampleExclusive <= item.sampleFrames,
    `AudioProgramPlan clip ${clip.id} target interval is invalid`);
    assert(Number.isSafeInteger(clip.sourceStartSample) && clip.sourceStartSample >= 0,
      `AudioProgramPlan clip ${clip.id} source start is invalid`);
    assert(Number.isSafeInteger(clip.sourceSampleFrames) && clip.sourceSampleFrames > 0
      && Number.isSafeInteger(clip.sourceEndSampleExclusive)
      && clip.sourceEndSampleExclusive > clip.sourceStartSample
      && clip.sourceEndSampleExclusive <= clip.sourceSampleFrames,
    `AudioProgramPlan clip ${clip.id} source interval is invalid`);
    const sourceLength = clip.sourceEndSampleExclusive - clip.sourceStartSample;
    assert(typeof clip.sourceLoop === "boolean"
      && Number.isSafeInteger(clip.sourcePhaseSample) && clip.sourcePhaseSample >= 0
      && clip.sourcePhaseSample < sourceLength
      && (clip.sourceLoop || clip.sourcePhaseSample === 0),
    `AudioProgramPlan clip ${clip.id} loop phase is invalid`);
    assert(Number.isFinite(clip.playbackRate) && clip.playbackRate > 0,
      `AudioProgramPlan clip ${clip.id} playback rate is invalid`);
    assert(Number.isSafeInteger(clip.mixStartSample) && clip.mixStartSample >= 0
      && Number.isSafeInteger(clip.mixEndSampleExclusive) && clip.mixEndSampleExclusive > clip.mixStartSample
      && clip.targetStartSample >= clip.mixStartSample && clip.targetEndSampleExclusive <= clip.mixEndSampleExclusive,
    `AudioProgramPlan clip ${clip.id} mix interval is invalid`);
    assert(Number.isFinite(clip.gain) && clip.gain >= 0 && clip.gain <= 64,
      `AudioProgramPlan clip ${clip.id} gain is invalid`);
    assertAudioLevelAutomation(clip, { startSample: clip.targetStartSample, endSampleExclusive: clip.targetEndSampleExclusive }, item.sampleFrames);
    const mixLength = clip.mixEndSampleExclusive - clip.mixStartSample;
    assert(Number.isSafeInteger(clip.fadeInSamples) && clip.fadeInSamples >= 0 && clip.fadeInSamples <= mixLength
      && Number.isSafeInteger(clip.fadeOutSamples) && clip.fadeOutSamples >= 0 && clip.fadeOutSamples <= mixLength,
    `AudioProgramPlan clip ${clip.id} fade is invalid`);
  }
  assert(item.mix?.normalize === false && item.mix?.limiter === "none",
    "AudioProgramPlan cannot hide normalization or limiting");
}

export function compileAudioProgramPlan(composition: Composition, timeline: Timeline): AudioProgramPlan {
  assertCompositionIdentity(composition, timeline);
  const frameCount = timelineFrameCount(timeline);
  const clips = composition.tracks
    .filter((track) => track.kind === "audio")
    .flatMap((track) => track.clips.flatMap((clip) => {
      if (clip.artifact.mediaType !== "audio/wav") {
        throw new Error(`Audio clip ${track.id}.${clip.id} must be normalized to canonical WAV before mixing`);
      }
      return clip.sourceTime.pieces.map((piece, pieceIndex) => {
        const targetLength = piece.target.endSampleExclusive - piece.target.startSample;
        const sourceAtStart = exactInteger(piece.sourceAtStart,
          `${track.id}.${clip.id} piece ${pieceIndex} source start`);
        const wrap = piece.wrap;
        return {
        id: `${track.id}:${clip.id}:${String(pieceIndex).padStart(4, "0")}`,
        artifact: {
          kind: "blob" as const,
          resource: clip.artifact.resource,
          size: clip.artifact.size,
          mediaType: clip.artifact.mediaType,
        },
        targetStartSample: clip.target.startSample + piece.target.startSample,
        targetEndSampleExclusive: clip.target.startSample + piece.target.endSampleExclusive,
        sourceSampleFrames: clip.sourceTime.sourceSampleFrames,
        sourceStartSample: wrap?.startSample ?? sourceAtStart,
        sourceEndSampleExclusive: wrap?.endSampleExclusive
          ?? exactSourceEnd(piece.sourceAtStart, piece.rate, targetLength,
            `${track.id}.${clip.id} piece ${pieceIndex} source end`),
        sourceLoop: wrap !== undefined,
        sourcePhaseSample: wrap === undefined ? 0 : sourceAtStart - wrap.startSample,
        playbackRate: piece.rate.numerator / piece.rate.denominator,
        mixStartSample: clip.target.startSample,
        mixEndSampleExclusive: clip.target.endSampleExclusive,
        gain: clip.gain,
        fadeInSamples: clip.fadeInSamples,
        fadeOutSamples: clip.fadeOutSamples,
        ...(clip.gainEnvelope === undefined ? {} : { gainEnvelope: clip.gainEnvelope }),
        ...(clip.audibility === undefined ? {} : { audibility: clip.audibility.flatMap((span) => {
          const startSample = Math.max(span.startSample, clip.target.startSample + piece.target.startSample);
          const endSampleExclusive = Math.min(span.endSampleExclusive, clip.target.startSample + piece.target.endSampleExclusive);
          return endSampleExclusive <= startSample ? [] : [{ startSample, endSampleExclusive }];
        }) }),
      };
      });
    }));
  return sealAudioProgramPlan({
    frameRate: { ...timeline.frameRate },
    frameCount,
    sampleRate: 48_000,
    sampleFrames: timelineFrameSampleBoundary(timeline, frameCount, 48_000),
    clips,
    mix: { normalize: false, limiter: "none" },
  });
}
