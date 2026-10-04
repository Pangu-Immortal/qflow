import { assertClockIdentity } from "@qflow/timeline";
import type { Clock } from "@qflow/timeline";

import type { LocalTemporalDomain, TemporalDuration, TemporalExtent } from "./types.js";
import type { Timeline } from "@qflow/timeline";
import { assertTimelineIdentity } from "@qflow/timeline";
import { durationInFrames } from "./rational.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertTemporalExtent(value: TemporalExtent): void {
  assertClockIdentity(value);
  assert(Number.isSafeInteger(value.frameCount) && value.frameCount >= 0,
    "TemporalExtent.frameCount is invalid.");
}

export function sealTemporalExtent(value: TemporalExtent): TemporalExtent {
  assertTemporalExtent(value);
  return structuredClone(value);
}

export function temporalExtentFromDomain(domain: LocalTemporalDomain): TemporalExtent {
  return sealTemporalExtent({ frameRate: structuredClone(domain.frameRate), frameCount: domain.frameCount });
}

export function temporalExtentFromDuration(duration: TemporalDuration, timeline: Timeline): TemporalExtent {
  assertTimelineIdentity(timeline);
  const frames = durationInFrames(duration, timeline);
  if (frames.denominator !== 1n || frames.numerator < 0n || frames.numerator > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Temporal duration must resolve to an exact non-negative frame count.");
  }
  return { frameRate: structuredClone(timeline.frameRate), frameCount: Number(frames.numerator) };
}

export function assertTemporalExtentClock(extent: TemporalExtent, clock: Clock): void {
  assertTemporalExtent(extent);
  assertClockIdentity(clock);
  assert(extent.frameRate.numerator === clock.frameRate.numerator
    && extent.frameRate.denominator === clock.frameRate.denominator,
  "TemporalExtent is not normalized to the selected Clock.");
}
