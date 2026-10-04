import { assertClockIdentity, assertTimelineIdentity } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";

import { assertTemporalWindowFor } from "./projection.js";
import type { LocalTemporalDomain, TemporalWindow } from "./types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertIdentity(value: string, label: string): void {
  assert(/^[A-Za-z][A-Za-z0-9_.:#-]{0,191}$/u.test(value), `${label} is invalid.`);
}

export function sealLocalTemporalDomain(value: LocalTemporalDomain): LocalTemporalDomain {
  assertLocalTemporalDomain(value);
  return structuredClone(value);
}

export function assertLocalTemporalDomain(value: LocalTemporalDomain): void {
  assertIdentity(value.id, "LocalTemporalDomain.id");
  assertClockIdentity(value);
  assert(Number.isSafeInteger(value.frameCount) && value.frameCount > 0,
    "LocalTemporalDomain.frameCount is invalid.");
}

/**
 * Verify the exact, total coordinate relation used by a domain-owned projector.
 * The relation is deliberately not materialized as a reusable author value.
 */
export function assertExactDomainWindow(
  domain: LocalTemporalDomain,
  window: TemporalWindow,
  timeline: Timeline,
): void {
  assertLocalTemporalDomain(domain);
  assertTimelineIdentity(timeline);
  assertTemporalWindowFor(window, { timeline });
  assert(domain.frameRate.numerator === timeline.frameRate.numerator
    && domain.frameRate.denominator === timeline.frameRate.denominator,
  `Local temporal domain ${domain.id} is not normalized to Timeline ${timeline.id}.`);
  assert(window.span.endFrameExclusive - window.span.startFrame === domain.frameCount,
    `Window ${window.id} does not cover the complete local temporal domain ${domain.id}.`);
}

/** Project one closed local boundary through an exact domain-to-Window relation. */
export function projectDomainFrame(
  domain: LocalTemporalDomain,
  window: TemporalWindow,
  timeline: Timeline,
  frame: number,
): number {
  assertExactDomainWindow(domain, window, timeline);
  assert(Number.isSafeInteger(frame) && frame >= 0 && frame <= domain.frameCount,
    `Local frame lies outside local temporal domain ${domain.id}.`);
  return window.span.startFrame + frame;
}
