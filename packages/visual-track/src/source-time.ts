import type {
  VisualSourceTimeMap,
  VisualSourceTimePiece,
  VisualSourceTimeRational,
} from "@qflow/composition";
import { assertTimelineIdentity } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";

import type {
  VisualSourceTimeBounds,
  VisualSourceTimePoint,
  VisualSourceTimeRelation,
  VisualSourceTimeSpec,
} from "./types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function rational(numerator: bigint, denominator = 1n): VisualSourceTimeRational {
  assert(denominator > 0n, "Visual source-time rational has an invalid denominator.");
  const divisor = gcd(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;
  assert(reducedNumerator >= BigInt(Number.MIN_SAFE_INTEGER)
    && reducedNumerator <= BigInt(Number.MAX_SAFE_INTEGER)
    && reducedDenominator <= BigInt(Number.MAX_SAFE_INTEGER),
  "Visual source-time rational exceeds safe wire arithmetic.");
  return { numerator: Number(reducedNumerator), denominator: Number(reducedDenominator) };
}

const START: VisualSourceTimePoint = { edge: "start", offsetFrames: 0 };
const END: VisualSourceTimePoint = { edge: "end", offsetFrames: 0 };
const FULL: VisualSourceTimeBounds = { from: START, until: END };

export function defaultVisualSourceTimeSpec(): VisualSourceTimeSpec {
  return {
    relations: [{
      kind: "rate",
      target: FULL,
      targetAt: START,
      sourceAt: START,
      rate: { numerator: 1, denominator: 1 },
      source: FULL,
    }],
  };
}

function assertPoint(value: VisualSourceTimePoint, label: string): void {
  assert(value.edge === "start" || value.edge === "end", `${label}.edge is invalid.`);
  assert(Number.isSafeInteger(value.offsetFrames), `${label}.offsetFrames is invalid.`);
  assert(value.edge === "start" ? value.offsetFrames >= 0 : value.offsetFrames <= 0,
    `${label} must point inward from its named edge.`);
}

function assertBounds(value: VisualSourceTimeBounds, label: string): void {
  assertPoint(value.from, `${label}.from`);
  assertPoint(value.until, `${label}.until`);
}

export function assertVisualSourceTimeSpec(value: VisualSourceTimeSpec, label = "VisualSourceTimeSpec"): void {
  assert(Array.isArray(value.relations) && value.relations.length > 0, `${label} requires at least one relation.`);
  for (const [index, relation] of value.relations.entries()) {
    const item = `${label}.relations.${index}`;
    assertBounds(relation.target, `${item}.target`);
    assertBounds(relation.source, `${item}.source`);
    if (relation.kind === "fit") continue;
    assert(relation.kind === "rate", `${item}.kind is invalid.`);
    assertPoint(relation.targetAt, `${item}.targetAt`);
    assertPoint(relation.sourceAt, `${item}.sourceAt`);
    assert(Number.isSafeInteger(relation.rate.numerator)
      && Number.isSafeInteger(relation.rate.denominator) && relation.rate.denominator > 0,
    `${item}.rate is invalid.`);
    if (relation.wrap !== undefined) assertBounds(relation.wrap, `${item}.wrap`);
  }
}

function point(value: VisualSourceTimePoint, length: number, label: string): number {
  const result = (value.edge === "start" ? 0 : length) + value.offsetFrames;
  assert(Number.isSafeInteger(result) && result >= 0 && result <= length, `${label} is outside its domain.`);
  return result;
}

function bounds(value: VisualSourceTimeBounds, length: number, label: string): { startFrame: number; endFrameExclusive: number } {
  const startFrame = point(value.from, length, `${label}.from`);
  const endFrameExclusive = point(value.until, length, `${label}.until`);
  assert(endFrameExclusive > startFrame, `${label} is empty or reversed.`);
  return { startFrame, endFrameExclusive };
}

function sourceAt(
  sourceAnchor: number,
  targetAnchor: number,
  rate: VisualSourceTimeRational,
  target: number,
): VisualSourceTimeRational {
  return rational(
    BigInt(sourceAnchor) * BigInt(rate.denominator)
      + BigInt(target - targetAnchor) * BigInt(rate.numerator),
    BigInt(rate.denominator),
  );
}

function compareToInteger(value: VisualSourceTimeRational, integer: number): number {
  const difference = BigInt(value.numerator) - BigInt(integer) * BigInt(value.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function firstTrue(from: number, until: number, predicate: (value: number) => boolean): number {
  let left = from;
  let right = until;
  while (left < right) {
    const middle = left + Math.floor((right - left) / 2);
    if (predicate(middle)) right = middle;
    else left = middle + 1;
  }
  return left;
}

function validTargetInterval(
  target: { startFrame: number; endFrameExclusive: number },
  source: { startFrame: number; endFrameExclusive: number },
  sourceAnchor: number,
  targetAnchor: number,
  rate: VisualSourceTimeRational,
): { startFrame: number; endFrameExclusive: number } | undefined {
  const at = (frame: number) => sourceAt(sourceAnchor, targetAnchor, rate, frame);
  if (rate.numerator === 0) {
    const sample = at(target.startFrame);
    return compareToInteger(sample, source.startFrame) >= 0
      && compareToInteger(sample, source.endFrameExclusive) < 0 ? target : undefined;
  }
  if (rate.numerator > 0) {
    const startFrame = firstTrue(target.startFrame, target.endFrameExclusive,
      (frame) => compareToInteger(at(frame), source.startFrame) >= 0);
    const endFrameExclusive = firstTrue(startFrame, target.endFrameExclusive,
      (frame) => compareToInteger(at(frame), source.endFrameExclusive) >= 0);
    return endFrameExclusive > startFrame ? { startFrame, endFrameExclusive } : undefined;
  }
  const startFrame = firstTrue(target.startFrame, target.endFrameExclusive,
    (frame) => compareToInteger(at(frame), source.endFrameExclusive) < 0);
  const endFrameExclusive = firstTrue(startFrame, target.endFrameExclusive,
    (frame) => compareToInteger(at(frame), source.startFrame) < 0);
  return endFrameExclusive > startFrame ? { startFrame, endFrameExclusive } : undefined;
}

function modulo(value: bigint, modulus: bigint): bigint {
  return ((value % modulus) + modulus) % modulus;
}

function wrapSource(value: VisualSourceTimeRational, wrap: { startFrame: number; endFrameExclusive: number }): VisualSourceTimeRational {
  const start = BigInt(wrap.startFrame) * BigInt(value.denominator);
  const length = BigInt(wrap.endFrameExclusive - wrap.startFrame) * BigInt(value.denominator);
  return rational(start + modulo(BigInt(value.numerator) - start, length), BigInt(value.denominator));
}

function resolveRateRelation(
  relation: Extract<VisualSourceTimeRelation, { readonly kind: "rate" }>,
  targetLength: number,
  sourceLength: number,
  label: string,
): VisualSourceTimePiece {
  const authoredTarget = bounds(relation.target, targetLength, `${label}.target`);
  const sourceBounds = bounds(relation.source, sourceLength, `${label}.source`);
  const targetAnchor = point(relation.targetAt, targetLength, `${label}.targetAt`);
  const sourceAnchor = point(relation.sourceAt, sourceLength, `${label}.sourceAt`);
  const wrap = relation.wrap === undefined ? undefined : bounds(relation.wrap, sourceLength, `${label}.wrap`);
  const target = wrap === undefined
    ? validTargetInterval(authoredTarget, sourceBounds, sourceAnchor, targetAnchor, relation.rate)
    : authoredTarget;
  assert(target !== undefined, `${label} does not sample any source frame.`);
  const rawStart = sourceAt(sourceAnchor, targetAnchor, relation.rate, target.startFrame);
  return {
    target,
    sourceAtStart: wrap === undefined ? rawStart : wrapSource(rawStart, wrap),
    rate: { ...relation.rate },
    ...(wrap === undefined ? {} : { wrap }),
  };
}

function resolveRelation(
  relation: VisualSourceTimeRelation,
  targetLength: number,
  sourceLength: number,
  label: string,
): VisualSourceTimePiece {
  if (relation.kind === "rate") return resolveRateRelation(relation, targetLength, sourceLength, label);
  const target = bounds(relation.target, targetLength, `${label}.target`);
  const source = bounds(relation.source, sourceLength, `${label}.source`);
  return {
    target,
    sourceAtStart: { numerator: source.startFrame, denominator: 1 },
    rate: rational(
      BigInt(source.endFrameExclusive - source.startFrame),
      BigInt(target.endFrameExclusive - target.startFrame),
    ),
  };
}

/** Resolve symbolic author relations into the exact stateless function consumed by renderers. */
export function resolveVisualSourceTime(input: {
  readonly timeline: Timeline;
  readonly sourceFrameRate: { readonly numerator: number; readonly denominator: number };
  readonly sourceFrameCount: number;
  readonly targetFrameCount: number;
  readonly spec?: VisualSourceTimeSpec;
}): VisualSourceTimeMap {
  assertTimelineIdentity(input.timeline);
  assert(Number.isSafeInteger(input.sourceFrameCount) && input.sourceFrameCount > 0,
    "Timed visual source frame count is invalid.");
  assert(Number.isSafeInteger(input.targetFrameCount) && input.targetFrameCount > 0,
    "Timed visual target frame count is invalid.");
  assert(input.sourceFrameRate.numerator === input.timeline.frameRate.numerator
    && input.sourceFrameRate.denominator === input.timeline.frameRate.denominator,
  "Timed visual source must be normalized to Timeline frame rate before Visual authoring.");
  const spec = input.spec ?? defaultVisualSourceTimeSpec();
  assertVisualSourceTimeSpec(spec);
  const pieces = spec.relations.map((relation, index) => resolveRelation(
    relation,
    input.targetFrameCount,
    input.sourceFrameCount,
    `VisualSourceTimeSpec.relations.${index}`,
  )).sort((left, right) => left.target.startFrame - right.target.startFrame);
  let previousEnd = 0;
  for (const [index, piece] of pieces.entries()) {
    assert(piece.target.startFrame >= previousEnd, `Visual source-time pieces ${index - 1} and ${index} overlap.`);
    previousEnd = piece.target.endFrameExclusive;
  }
  return {
    sourceFrameRate: { ...input.sourceFrameRate },
    sourceFrameCount: input.sourceFrameCount,
    pieces,
  };
}
