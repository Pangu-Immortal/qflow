import { narrativeTypes } from "@qflow/narrative";
import { sameType } from "@qflow/protocol";
import type { StudioScriptProjectionInput, StudioScriptProjection } from "@qflow/studio-adapter";

type NarrativeValue = {
  readonly id?: string;
  readonly segments?: readonly {
    readonly id: string;
    readonly startAnchorId: string;
    readonly endAnchorId: string;
  }[];
  readonly tokens?: readonly {
    readonly id: string;
    readonly segmentId: string;
    readonly startAnchorId: string;
    readonly endAnchorId: string;
    readonly text: string;
  }[];
  readonly selections?: readonly {
    readonly id: string;
    readonly startAnchorId: string;
    readonly endAnchorId: string;
  }[];
  readonly moments?: readonly {
    readonly id: string;
    readonly anchorId: string;
  }[];
  readonly semanticIndex?: {
    readonly anchors?: readonly {
      readonly id: string;
      readonly kind: "segment-start" | "segment-end" | "token-start" | "token-end";
      readonly segmentId?: string;
      readonly tokenId?: string;
    }[];
  };
};

export function projectScriptTimeline(input: StudioScriptProjectionInput): StudioScriptProjection {
  const records = input.values.filter((item) =>
    sameType(item.type, narrativeTypes.narrative)
    && (item.value as NarrativeValue).id === input.source.narrativeId);
  if (records.length > 1) {
    throw new Error(`Studio Narrative id ${input.source.narrativeId} resolves to more than one authored value.`);
  }
  const record = records[0];
  const narrative = record?.value as NarrativeValue | undefined;
  if (narrative === undefined) throw new Error("Studio Narrative is not an inline authored value.");

  const segmentRanges = new Map((input.source.segments ?? []).map((item) => [item.id, item.range]));
  const tokenRanges = new Map((input.source.tokens ?? []).map((item) => [item.id, item.range]));
  const frame = (id: string): number | undefined => input.anchors.get(id);

  const segments = (narrative.segments ?? []).flatMap((segment) => {
    const startFrame = frame(segment.startAnchorId);
    const endFrame = frame(segment.endAnchorId);
    if (startFrame === undefined || endFrame === undefined) return [];
    return [{
      id: segment.id,
      startFrame,
      endFrameExclusive: Math.max(startFrame + 1, endFrame),
      ...(segmentRanges.has(segment.id) ? { range: segmentRanges.get(segment.id)! } : {}),
    }];
  });
  const tokens = (narrative.tokens ?? []).flatMap((token) => {
    const startFrame = frame(token.startAnchorId);
    const endFrame = frame(token.endAnchorId);
    if (startFrame === undefined || endFrame === undefined) return [];
    return [{
      id: token.id,
      segmentId: token.segmentId,
      text: token.text,
      startFrame,
      endFrameExclusive: Math.max(startFrame + 1, endFrame),
      ...(tokenRanges.has(token.id) ? { range: tokenRanges.get(token.id)! } : {}),
    }];
  });
  const anchors = (narrative.semanticIndex?.anchors ?? []).flatMap((anchor) => {
    const at = frame(anchor.id);
    if (at === undefined) return [];
    return [{
      id: anchor.id,
      kind: anchor.kind,
      frame: at,
      ...(anchor.segmentId === undefined ? {} : { segmentId: anchor.segmentId }),
      ...(anchor.tokenId === undefined ? {} : { tokenId: anchor.tokenId }),
    }];
  });
  const selections = (narrative.selections ?? []).flatMap((selection) => {
    const startFrame = frame(selection.startAnchorId);
    const endFrameExclusive = frame(selection.endAnchorId);
    if (startFrame === undefined || endFrameExclusive === undefined || endFrameExclusive <= startFrame) return [];
    return [{
      id: selection.id,
      startAnchorId: selection.startAnchorId,
      endAnchorId: selection.endAnchorId,
      startFrame,
      endFrameExclusive,
    }];
  });
  const moments = (narrative.moments ?? []).flatMap((moment) => {
    const at = frame(moment.anchorId);
    return at === undefined ? [] : [{ id: moment.id, anchorId: moment.anchorId, frame: at }];
  });
  return { anchors, segments, tokens, selections, moments };
}
