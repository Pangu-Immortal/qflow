import type { StudioEditHandle, StudioTemporalDomainAnchor, StudioTemporalDomainEditTarget, StudioTemporalInstantProjection } from "@qflow/studio-companion";

export type DomainTarget = StudioTemporalDomainEditTarget;

type Span = { readonly startFrame: number; readonly endFrameExclusive: number };

/** Project only the domain write exposed by the handle. This does not invert expressions. */
export function domainGestureSpan(
  anchors: readonly StudioTemporalDomainAnchor[], handle: StudioEditHandle, target: DomainTarget,
): Span | undefined {
  const domain = handle.domain;
  const temporal = handle.temporal;
  if (!domain || !temporal || target.kind !== domain.kind
    || target.companion !== domain.companion || target.domainId !== domain.domainId
    || target.itemId !== domain.itemId) return undefined;
  const byId = new Map(anchors.map((anchor, order) => [anchor.id, { ...anchor, order }]));
  let span: Span;
  if (domain.kind === "point" && target.kind === "point") {
    const previous = byId.get(domain.anchorId);
    const next = byId.get(target.anchorId);
    if (!previous || !next) return undefined;
    const delta = next.frame - previous.frame;
    span = temporal.kind === "instant"
      ? { startFrame: temporal.frame + delta, endFrameExclusive: temporal.frame + delta + 1 }
      : { startFrame: temporal.startFrame + delta, endFrameExclusive: temporal.endFrameExclusive + delta };
  } else if (domain.kind === "span" && target.kind === "span") {
    const start = byId.get(target.startAnchorId);
    const end = byId.get(target.endAnchorId);
    if (!start || !end || start.order > end.order) return undefined;
    if (temporal.kind === "instant") {
      if (temporal.authority.kind !== "domain") return undefined;
      if (temporal.authority.boundary === "start" && target.endAnchorId !== domain.endAnchorId
        || temporal.authority.boundary === "end" && target.startAnchorId !== domain.startAnchorId) return undefined;
      const frame = temporal.authority.boundary === "start" ? start.frame : end.frame;
      span = { startFrame: frame, endFrameExclusive: frame + 1 };
    } else {
      if (handle.gesture === "trim-start" && target.endAnchorId !== domain.endAnchorId
        || handle.gesture === "trim-end" && target.startAnchorId !== domain.startAnchorId) return undefined;
      if (handle.gesture === "move") {
        const stops = [...new Set(anchors.map((anchor) => anchor.frame))].sort((a, b) => a - b);
        const previousStart = byId.get(domain.startAnchorId);
        const previousEnd = byId.get(domain.endAnchorId);
        if (!previousStart || !previousEnd
          || stops.indexOf(start.frame) - stops.indexOf(previousStart.frame)
            !== stops.indexOf(end.frame) - stops.indexOf(previousEnd.frame)) return undefined;
      }
      span = { startFrame: start.frame, endFrameExclusive: end.frame };
    }
  } else return undefined;
  if (!Number.isSafeInteger(span.startFrame) || span.startFrame < 0
    || !Number.isSafeInteger(span.endFrameExclusive) || span.endFrameExclusive <= span.startFrame) return undefined;
  if (temporal.kind === "window"
    && ((handle.gesture === "trim-start" && span.endFrameExclusive !== temporal.endFrameExclusive)
      || (handle.gesture === "trim-end" && span.startFrame !== temporal.startFrame))) return undefined;
  return span;
}

/** A stop is a frame position; coincident anchors remain distinct choices at that stop. */
export function chooseDomainGesture(input: {
  readonly anchors: readonly StudioTemporalDomainAnchor[];
  readonly handle: StudioEditHandle;
  readonly pointerStart: number;
  readonly pointerNow: number;
  readonly frameCount: number;
}): DomainTarget | undefined {
  const { anchors, handle } = input;
  const domain = handle.domain;
  const temporal = handle.temporal;
  if (!domain || !temporal) return undefined;
  const order = new Map(anchors.map((anchor, index) => [anchor.id, index]));
  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
  const at = new Map<number, StudioTemporalDomainAnchor[]>();
  for (const anchor of anchors) at.set(anchor.frame, [...at.get(anchor.frame) ?? [], anchor]);
  const stops = [...at.keys()].sort((a, b) => a - b);
  const ranked = (choices: readonly StudioTemporalDomainAnchor[], preferred: StudioTemporalDomainAnchor) => [...choices].sort((a, b) =>
    Number(a.id !== preferred.id) - Number(b.id !== preferred.id)
    || Number(a.kind !== preferred.kind) - Number(b.kind !== preferred.kind)
    || order.get(a.id)! - order.get(b.id)!);
  const valid = (target: DomainTarget) => {
    const span = domainGestureSpan(anchors, handle, target);
    return span !== undefined && (temporal.kind === "instant" ? span.startFrame : span.endFrameExclusive) <= input.frameCount;
  };
  const delta = input.pointerNow - input.pointerStart;
  if (domain.kind === "point") {
    const current = byId.get(domain.anchorId);
    if (!current) return undefined;
    const candidates = ranked(anchors, current).sort((a, b) =>
      Math.abs(a.frame - current.frame - delta) - Math.abs(b.frame - current.frame - delta));
    return candidates.map((anchor): DomainTarget => ({ kind: "point", companion: domain.companion,
      domainId: domain.domainId, itemId: domain.itemId, anchorId: anchor.id })).find(valid);
  }
  const start = byId.get(domain.startAnchorId);
  const end = byId.get(domain.endAnchorId);
  if (!start || !end) return undefined;
  const target = (a: StudioTemporalDomainAnchor, b: StudioTemporalDomainAnchor): DomainTarget => ({
    kind: "span", companion: domain.companion, domainId: domain.domainId, itemId: domain.itemId,
    startAnchorId: a.id, endAnchorId: b.id,
  });
  if (handle.gesture === "move" && temporal.kind === "window") {
    const first = stops.indexOf(start.frame);
    const last = stops.indexOf(end.frame);
    const shifts = stops.map((_, index) => index - first)
      .filter((shift) => last + shift >= 0 && last + shift < stops.length)
      .sort((a, b) => Math.abs(stops[first + a]! - start.frame - delta)
        - Math.abs(stops[first + b]! - start.frame - delta) || Math.abs(a) - Math.abs(b));
    for (const shift of shifts) {
      for (const a of ranked(at.get(stops[first + shift]!)!, start)) {
        for (const b of ranked(at.get(stops[last + shift]!)!, end)) {
          const candidate = target(a, b);
          if (valid(candidate)) return candidate;
        }
      }
    }
    return undefined;
  }
  const boundary = temporal.kind === "instant" && temporal.authority.kind === "domain"
    ? temporal.authority.boundary : handle.gesture === "trim-start" ? "start" : "end";
  const current = boundary === "start" ? start : end;
  const candidates = ranked(anchors, current).sort((a, b) =>
    Math.abs(a.frame - current.frame - delta) - Math.abs(b.frame - current.frame - delta));
  return candidates.map((anchor) => boundary === "start" ? target(anchor, end) : target(start, anchor)).find(valid);
}


/** Keep the reference and write its local frame offset; a bare reference starts at zero. */
export function formatTemporalPointEdit(
  reference: StudioTemporalInstantProjection["reference"], desired: number, base?: number,
): string {
  if (reference === "absolute") return `${desired}f`;
  if (base === undefined) throw new Error(`The ${reference} projection base is unavailable.`);
  const offset = desired - base;
  return `${reference}${offset >= 0 ? "+" : ""}${offset}f`;
}
