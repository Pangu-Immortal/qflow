import { narrativeTypes } from "@qflow/narrative";
import { narrativeTemporalTypes } from "@qflow/narrative-temporal";
import type { NarrativeProjection } from "@qflow/narrative-temporal";
import { sameType } from "@qflow/protocol";
import type { Range, StudioTemporalDomainProjection, StudioTemporalDomainProjectionInput } from "@qflow/studio-adapter";

type NarrativeValue = {
  readonly id?: string;
  readonly segments?: readonly { readonly id: string; readonly startAnchorId: string; readonly endAnchorId: string }[];
  readonly tokens?: readonly { readonly id: string; readonly segmentId: string; readonly startAnchorId: string; readonly endAnchorId: string; readonly text: string }[];
  readonly selections?: readonly { readonly id: string; readonly startAnchorId: string; readonly endAnchorId: string }[];
  readonly moments?: readonly { readonly id: string; readonly anchorId: string }[];
  readonly anchors?: readonly { readonly id: string; readonly kind: string; readonly segmentId?: string; readonly tokenId?: string }[];
};

export type ScriptStudioObservation = {
  readonly segments: readonly { readonly id: string; readonly range: Range }[];
  readonly selections: readonly { readonly id: string; readonly startAnchorId: string; readonly endAnchorId: string; readonly open: Range; readonly close: Range }[];
  readonly moments: readonly { readonly id: string; readonly anchorId: string; readonly range: Range }[];
  readonly tokens: readonly { readonly id: string; readonly range: Range }[];
};

function one<T>(values: readonly T[], subject: string): T | undefined {
  if (values.length > 1) throw new Error(`${subject} resolves to more than one authored value.`);
  return values[0];
}

export function projectScriptTemporalDomain(input: StudioTemporalDomainProjectionInput): StudioTemporalDomainProjection | undefined {
  const narrative = one(input.values.filter((item) => sameType(item.type, narrativeTypes.narrative)
    && (item.value as NarrativeValue).id === input.source.domainId), `Studio Narrative id ${input.source.domainId}`)?.value as NarrativeValue | undefined;
  if (narrative === undefined) return undefined;
  const projection = one(input.values.filter((item) => sameType(item.type, narrativeTemporalTypes.narrativeProjection)
    && (item.value as NarrativeProjection).narrativeId === input.source.domainId
    && (item.value as NarrativeProjection).timelineId === input.timeline.id), `Studio Narrative projection ${input.source.domainId}`)?.value as NarrativeProjection | undefined;
  if (projection === undefined) return undefined;
  const source = input.source.data as ScriptStudioObservation;
  const segmentRanges = new Map(source.segments.map((item) => [item.id, item.range]));
  const tokenRanges = new Map(source.tokens.map((item) => [item.id, item.range]));
  const selectionRanges = new Map(source.selections.map((item) => [item.id, { start: item.open.start, end: item.close.end }]));
  const momentRanges = new Map(source.moments.map((item) => [item.id, item.range]));
  const frame = new Map(projection.boundaries.map((boundary) => [boundary.id, boundary.frame]));
  const tokenText = new Map((narrative.tokens ?? []).map((token) => [token.id, token.text]));
  const anchors = (narrative.anchors ?? []).flatMap((anchor) => {
    const at = frame.get(anchor.id);
    if (at === undefined) return [];
    const detail = [anchor.tokenId === undefined ? undefined : tokenText.get(anchor.tokenId), anchor.segmentId]
      .filter((part): part is string => part !== undefined).join(" · ");
    return [{ id: anchor.id, kind: anchor.kind, frame: at,
      ...(anchor.tokenId === undefined ? {} : { label: tokenText.get(anchor.tokenId) ?? anchor.tokenId }),
      ...(detail.length === 0 ? {} : { detail }) }];
  });
  const segments = (narrative.segments ?? []).flatMap((segment) => {
    const startFrame = frame.get(segment.startAnchorId); const endFrame = frame.get(segment.endAnchorId);
    if (startFrame === undefined || endFrame === undefined) return [];
    return [{ kind: "span" as const, appearance: "block" as const, id: segment.id, laneId: "segments", label: segment.id,
      source: { type: narrativeTypes.segmentRef, kind: "segment", id: segment.id }, startAnchorId: segment.startAnchorId,
      endAnchorId: segment.endAnchorId, startFrame, endFrameExclusive: Math.max(startFrame + 1, endFrame),
      ...(segmentRanges.has(segment.id) ? { range: segmentRanges.get(segment.id)! } : {}) }];
  });
  const tokens = (narrative.tokens ?? []).flatMap((token) => {
    const startFrame = frame.get(token.startAnchorId); const endFrame = frame.get(token.endAnchorId);
    if (startFrame === undefined || endFrame === undefined) return [];
    return [{ kind: "span" as const, appearance: "compact" as const, id: token.id, laneId: "tokens", label: token.text,
      startAnchorId: token.startAnchorId, endAnchorId: token.endAnchorId, startFrame,
      endFrameExclusive: Math.max(startFrame + 1, endFrame), followPlayhead: true,
      ...(tokenRanges.has(token.id) ? { range: tokenRanges.get(token.id)! } : {}) }];
  });
  const selections = (narrative.selections ?? []).flatMap((selection) => {
    const startFrame = frame.get(selection.startAnchorId); const endFrameExclusive = frame.get(selection.endAnchorId);
    if (startFrame === undefined || endFrameExclusive === undefined || endFrameExclusive <= startFrame) return [];
    return [{ kind: "span" as const, appearance: "block" as const, id: selection.id, laneId: "intent", label: selection.id,
      source: { type: narrativeTypes.selection, kind: "selection", id: selection.id }, editable: true,
      startAnchorId: selection.startAnchorId, endAnchorId: selection.endAnchorId, startFrame, endFrameExclusive,
      ...(selectionRanges.has(selection.id) ? { range: selectionRanges.get(selection.id)! } : {}) }];
  });
  const moments = (narrative.moments ?? []).flatMap((moment) => {
    const at = frame.get(moment.anchorId); if (at === undefined) return [];
    return [{ kind: "point" as const, appearance: "marker" as const, id: moment.id, laneId: "intent", label: moment.id,
      source: { type: narrativeTypes.moment, kind: "moment", id: moment.id }, editable: true,
      anchorId: moment.anchorId, frame: at, ...(momentRanges.has(moment.id) ? { range: momentRanges.get(moment.id)! } : {}) }];
  });
  return { id: input.source.domainId, timelineId: input.timeline.id,
    lanes: [{ id: "segments", label: "Segments", heightPx: 26 },
      ...(tokens.length === 0 ? [] : [{ id: "tokens", label: "Words", heightPx: 26 }]),
      ...(selections.length + moments.length === 0 ? [] : [{ id: "intent", label: "Intent", heightPx: 26 }])],
    anchors, items: [...segments, ...tokens, ...selections, ...moments] };
}
