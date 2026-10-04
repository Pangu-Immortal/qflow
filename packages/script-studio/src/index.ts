import { projectScriptTemporalDomain } from "./projection.js";
import { adjustScriptMoment, adjustScriptSelection, parseScript, scriptModuleRef } from "@qflow/script";
import { narrativeTypes } from "@qflow/narrative";
import { narrativeTemporalTypes } from "@qflow/narrative-temporal";
import { sameType } from "@qflow/protocol";
import type { StudioTemporalDomainCompanion } from "@qflow/studio-adapter";

const scriptTemporalSourceTypes = [narrativeTypes.segmentRef, narrativeTypes.selection, narrativeTypes.moment] as const;

export const scriptStudioTemporalDomains: readonly StudioTemporalDomainCompanion[] = [{
  id: "script",
  match: { module: scriptModuleRef, surface: "script" },
  valueTypes: [narrativeTypes.narrative, narrativeTemporalTypes.narrativeProjection],
  sourceTypes: scriptTemporalSourceTypes,
  presentation: { family: "narrative", tone: "teal", label: "Narrative", icon: "brand" },
  identify({ type, value }) {
    if (!scriptTemporalSourceTypes.some((candidate) => sameType(candidate, type))) return undefined;
    const held = value as { readonly narrativeId?: unknown; readonly id?: unknown; readonly kind?: unknown };
    if (typeof held.narrativeId !== "string" || typeof held.id !== "string") return undefined;
    const kind = sameType(type, narrativeTypes.segmentRef) ? "segment"
      : sameType(type, narrativeTypes.selection) ? "selection"
      : sameType(type, narrativeTypes.moment) ? "moment"
      : typeof held.kind === "string" ? held.kind : undefined;
    return kind === undefined ? undefined : { domainId: held.narrativeId, kind, id: held.id };
  },
  project: projectScriptTemporalDomain,
  observe(input) {
    const narrativeId = input.attributes.id ?? "script";
    if (typeof narrativeId !== "string" || narrativeId.length === 0) return undefined;
    if (input.source === undefined || input.contentStart === undefined) return undefined;
    const closing = `</${input.tag}>`;
    const closeEnd = input.nextOffset;
    if (closeEnd === undefined) return undefined;
    const end = closeEnd - closing.length;
    if (end < input.contentStart || input.source.slice(end, closeEnd) !== closing) return undefined;
    const parsed = parseScript(
      input.sourceName,
      input.source.slice(input.contentStart, end), input.contentStart,
    );
    return {
      domainId: narrativeId,
      sourcePath: input.sourceName,
      range: { start: input.range.start, end: closeEnd },
      content: { start: input.contentStart, end },
      data: {
        segments: parsed.segments.map((segment) => ({ id: segment.id, range: segment.range })),
        selections: parsed.selections.map((selection) => ({
          id: selection.id,
          startAnchorId: selection.startAnchorId,
          endAnchorId: selection.endAnchorId,
          open: selection.open.range,
          close: selection.close.range,
        })),
        moments: parsed.moments.map((moment) => ({ id: moment.id, anchorId: moment.anchorId, range: moment.range })),
        tokens: parsed.tokens.map((token) => ({ id: token.id, range: token.range })),
      },
    };
  },
  adjust(input) {
    const parsed = parseScript(input.sourceName, input.source);
    return input.adjustment.kind === "span"
      ? adjustScriptSelection({
          sourceName: input.sourceName,
          source: input.source,
          parsed,
          adjustment: {
            id: input.adjustment.itemId,
            startAnchorId: input.adjustment.startAnchorId,
            endAnchorId: input.adjustment.endAnchorId,
          },
        })
      : adjustScriptMoment({
          sourceName: input.sourceName,
          source: input.source,
          parsed,
          adjustment: { id: input.adjustment.itemId, anchorId: input.adjustment.anchorId },
        });
  },
}];
