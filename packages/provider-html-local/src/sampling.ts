import type { MediaFrameRange } from "@qflow/qflow/media";
import type { HtmlFrameSource } from "@qflow/qflow/html-program";
import { FrameSpanIndex } from "./frame-span-index.js";
import { assert } from "./process.js";

type Rational = { readonly numerator: bigint; readonly denominator: bigint };
export type VideoSlot = MediaFrameRange & {
  readonly id: string;
  readonly src: string;
  readonly sourceFrame: Rational;
  readonly sourceRate: Rational;
  readonly sourceFps: { readonly num: number; readonly den: number };
};

/** Compact an ordered frame selection into the half-open spans shared with the page runtime. */
export function requestedFrameRanges(range: MediaFrameRange, frames?: readonly number[]): MediaFrameRange[] {
  if (frames === undefined) return [{ ...range }];
  const result: MediaFrameRange[] = [];
  for (const frame of frames) {
    assert(Number.isSafeInteger(frame) && frame >= 0, "HTML Program requested frame is invalid");
    const previous = result.at(-1);
    if (previous !== undefined && previous.endFrameExclusive === frame) {
      result[result.length - 1] = { startFrame: previous.startFrame, endFrameExclusive: frame + 1 };
    } else {
      assert(previous === undefined || previous.endFrameExclusive < frame,
        "HTML Program requested frames must be strictly increasing");
      result.push({ startFrame: frame, endFrameExclusive: frame + 1 });
    }
  }
  assert(result.length > 0, "HTML Program requested frames must not be empty");
  return result;
}

/** Project the compiler's typed source plan onto staged paths; markup is never parsed back into execution data. */
export function videoSlots(sources: readonly HtmlFrameSource[], pathFor: (resource: string) => string): VideoSlot[] {
  return sources.map((source) => ({
    id: source.id,
    src: pathFor(source.resource),
    startFrame: source.startFrame,
    endFrameExclusive: source.endFrameExclusive,
    sourceFrame: { numerator: BigInt(source.sourceFrame.numerator), denominator: BigInt(source.sourceFrame.denominator) },
    sourceRate: { numerator: BigInt(source.sourceRate.numerator), denominator: BigInt(source.sourceRate.denominator) },
    sourceFps: { num: source.sourceFrameRate.numerator, den: source.sourceFrameRate.denominator },
  }));
}

/** A decoded frame owns [n, n+1) in source-frame coordinates. */
export function sourceFrameAt(slot: VideoSlot, frame: number): number {
  const a = slot.sourceFrame;
  const r = slot.sourceRate;
  const value = Number((a.numerator * r.denominator
    + BigInt(frame - slot.startFrame) * r.numerator * a.denominator) / (a.denominator * r.denominator));
  assert(Number.isSafeInteger(value) && value >= 0, "HTML Program source frame exceeds safe arithmetic");
  return value;
}

export function sourceWindows(slots: readonly VideoSlot[], selection: MediaFrameRange | readonly MediaFrameRange[],
  index = new FrameSpanIndex(slots)) {
  const ranges: readonly MediaFrameRange[] = Array.isArray(selection) ? selection : [selection as MediaFrameRange];
  const sources = new Map<string, { fps: VideoSlot["sourceFps"]; windows: MediaFrameRange[] }>();
  for (const range of ranges) for (const slot of index.overlapping(range)) {
    const first = Math.max(range.startFrame, slot.startFrame);
    const last = Math.min(range.endFrameExclusive, slot.endFrameExclusive) - 1;
    if (last < first) continue;
    let source = sources.get(slot.src);
    if (source === undefined) {
      source = { fps: slot.sourceFps, windows: [] };
      sources.set(slot.src, source);
    }
    assert(source.fps.num * slot.sourceFps.den === slot.sourceFps.num * source.fps.den,
      "One HTML Program source has conflicting frame rates");
    const firstSource = sourceFrameAt(slot, first);
    const lastSource = sourceFrameAt(slot, last);
    source.windows.push({
      startFrame: Math.min(firstSource, lastSource),
      endFrameExclusive: Math.max(firstSource, lastSource) + 1,
    });
  }
  return [...sources].map(([src, source]) => {
    const windows: MediaFrameRange[] = [];
    for (const window of source.windows.sort((a, b) => a.startFrame - b.startFrame)) {
      const previous = windows.at(-1);
      if (previous !== undefined && window.startFrame <= previous.endFrameExclusive) {
        windows[windows.length - 1] = { startFrame: previous.startFrame,
          endFrameExclusive: Math.max(previous.endFrameExclusive, window.endFrameExclusive) };
      } else windows.push(window);
    }
    return { src, fps: source.fps, windows };
  });
}

export function distributeFrameRange(range: MediaFrameRange, workers: number): MediaFrameRange[] {
  const count = range.endFrameExclusive - range.startFrame;
  const active = Math.min(count, workers);
  return Array.from({ length: active }, (_, index) => ({
    startFrame: range.startFrame + Math.floor(index * count / active),
    endFrameExclusive: range.startFrame + Math.floor((index + 1) * count / active),
  }));
}
