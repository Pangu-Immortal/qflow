import type { HyperframesFrameSpan } from "./types.js";

/**
 * Page-local absolute-frame work lookup shared by HyperFrames runtime features.
 *
 * The index deliberately knows only half-open frame spans, stable order and an
 * opaque payload. Text, animation and media semantics remain with their own
 * evaluators. Every render page derives and discards its own index.
 */
export const frameSelectionRuntime = String.raw`
const hyperframesRequestedFrameSpans = (() => {
  const source = globalThis.__hyperframesRequestedFrameSpans;
  if (source === undefined) return null;
  if (!Array.isArray(source)) throw new Error('HyperFrames requested frame spans must be an array.');
  let previousEnd = -1;
  return Object.freeze(source.map((span) => {
    if (!Array.isArray(span) || span.length !== 2) {
      throw new Error('HyperFrames requested frame span must be a [start, end) pair.');
    }
    const startFrame = Number(span[0]);
    const endFrameExclusive = Number(span[1]);
    if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrameExclusive)
      || startFrame < 0 || endFrameExclusive <= startFrame || startFrame < previousEnd) {
      throw new Error('HyperFrames requested frame spans must be ordered, disjoint and valid.');
    }
    previousEnd = endFrameExclusive;
    return Object.freeze({ startFrame, endFrameExclusive });
  }));
})();
const hyperframesSelectionOverlaps = (startFrame, endFrameExclusive) => {
  if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrameExclusive)
    || startFrame < 0 || endFrameExclusive <= startFrame) {
    throw new Error('HyperFrames selection query span is invalid.');
  }
  if (hyperframesRequestedFrameSpans === null) return true;
  let low = 0;
  let high = hyperframesRequestedFrameSpans.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (hyperframesRequestedFrameSpans[middle].endFrameExclusive <= startFrame) low = middle + 1;
    else high = middle;
  }
  const candidate = hyperframesRequestedFrameSpans[low];
  return candidate !== undefined && candidate.startFrame < endFrameExclusive;
};
`;

export const frameWorkIndexRuntime = String.raw`${frameSelectionRuntime}
const hyperframesCreateFrameWorkIndex = (sourceEntries) => {
  const entries = sourceEntries.map((entry, serial) => {
    const startFrame = Number(entry.startFrame);
    const endFrameExclusive = Number(entry.endFrameExclusive);
    const order = entry.order === undefined ? serial : Number(entry.order);
    if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrameExclusive)
      || startFrame < 0 || endFrameExclusive <= startFrame || !Number.isSafeInteger(order)) {
      throw new Error('HyperFrames frame work has an invalid span or order.');
    }
    return Object.freeze({ startFrame, endFrameExclusive, order, serial, payload: entry.payload });
  });
  const build = (items) => {
    if (items.length === 0) return null;
    const centers = items
      .map((entry) => entry.startFrame + (entry.endFrameExclusive - entry.startFrame) / 2)
      .sort((left, right) => left - right);
    const center = centers[Math.floor(centers.length / 2)];
    const left = [];
    const right = [];
    const overlaps = [];
    for (const entry of items) {
      if (entry.endFrameExclusive <= center) left.push(entry);
      else if (entry.startFrame > center) right.push(entry);
      else overlaps.push(entry);
    }
    return Object.freeze({
      center,
      byStart: Object.freeze([...overlaps].sort((a, b) =>
        a.startFrame - b.startFrame || a.endFrameExclusive - b.endFrameExclusive || a.serial - b.serial)),
      byEnd: Object.freeze([...overlaps].sort((a, b) =>
        b.endFrameExclusive - a.endFrameExclusive || a.startFrame - b.startFrame || a.serial - b.serial)),
      left: build(left),
      right: build(right),
    });
  };
  const root = build(entries);
  const collect = (node, frame, result) => {
    if (node === null) return;
    if (frame < node.center) {
      for (const entry of node.byStart) {
        if (entry.startFrame > frame) break;
        result.push(entry);
      }
      collect(node.left, frame, result);
      return;
    }
    for (const entry of node.byEnd) {
      if (entry.endFrameExclusive <= frame) break;
      result.push(entry);
    }
    collect(node.right, frame, result);
  };
  const collectOverlapping = (node, span, result) => {
    if (node === null) return;
    for (const entry of node.byStart) {
      if (entry.startFrame >= span.endFrameExclusive) break;
      if (entry.endFrameExclusive > span.startFrame) result.push(entry);
    }
    if (span.startFrame < node.center) collectOverlapping(node.left, span, result);
    if (span.endFrameExclusive > node.center) collectOverlapping(node.right, span, result);
  };
  const ordered = (result) => result.sort((left, right) => left.order - right.order || left.serial - right.serial);
  return Object.freeze({
    at(frame) {
      if (!Number.isSafeInteger(frame) || frame < 0) throw new Error('HyperFrames frame work query is invalid.');
      const result = [];
      collect(root, frame, result);
      return ordered(result);
    },
    overlapping(span) {
      const startFrame = Number(span?.startFrame);
      const endFrameExclusive = Number(span?.endFrameExclusive);
      if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrameExclusive)
        || startFrame < 0 || endFrameExclusive <= startFrame) {
        throw new Error('HyperFrames frame work query span is invalid.');
      }
      const result = [];
      collectOverlapping(root, { startFrame, endFrameExclusive }, result);
      return ordered(result);
    },
  });
};`;

/**
 * A render-local hint installed before the compiled page runs. It describes
 * only absolute frame spans; worker assignment and capture machinery remain
 * private to the Provider.
 */
export function hyperframesFrameSelectionPrelude(spans: readonly HyperframesFrameSpan[]): string {
  let previousEnd = -1;
  const encoded = spans.map((span) => {
    if (!Number.isSafeInteger(span.startFrame) || !Number.isSafeInteger(span.endFrameExclusive)
      || span.startFrame < 0 || span.endFrameExclusive <= span.startFrame || span.startFrame < previousEnd) {
      throw new Error("HyperFrames requested frame spans must be ordered, disjoint and valid.");
    }
    previousEnd = span.endFrameExclusive;
    return [span.startFrame, span.endFrameExclusive];
  });
  return `Object.defineProperty(globalThis,"__hyperframesRequestedFrameSpans",{value:${JSON.stringify(encoded)},writable:false,configurable:false});`;
}
