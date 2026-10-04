import type { ValueSchema } from "@qflow/protocol";

const string = { kind: "string", minLength: 1 } as const;
const integer = { kind: "number", integer: true, minimum: 0 } as const;
const object = (
  fields: Readonly<Record<string, { readonly schema: ValueSchema; readonly optional?: boolean }>>,
): ValueSchema => ({ kind: "object", fields });
const semanticAnchor: ValueSchema = { kind: "oneOf", variants: [
  object({
    id: { schema: string }, kind: { schema: { kind: "string", enum: ["segment-start", "segment-end"] } },
    segmentId: { schema: string },
  }),
  object({
    id: { schema: string }, kind: { schema: { kind: "string", enum: ["token-start", "token-end"] } },
    segmentId: { schema: string }, tokenId: { schema: string },
  }),
] };
export const narrativeSegmentRefSchema: ValueSchema = object({
  narrativeId: { schema: string },
  kind: { schema: { kind: "literal", value: "segment" } }, id: { schema: string },
  tokenStart: { schema: integer }, tokenEndExclusive: { schema: integer },
});
export const narrativeSchema: ValueSchema = object({
  id: { schema: string },
  segments: { schema: { kind: "array", minItems: 1, items: object({
    id: { schema: string }, startAnchorId: { schema: string },
    endAnchorId: { schema: string }, tokenStart: { schema: integer }, tokenEndExclusive: { schema: integer },
  }) } },
  tokens: { schema: { kind: "array", items: object({
    id: { schema: string }, segmentId: { schema: string },
    startAnchorId: { schema: string }, endAnchorId: { schema: string },
    text: { schema: string }, normalized: { schema: string },
  }) } },
  turns: { schema: { kind: "array", items: object({
    id: { schema: string }, segmentId: { schema: string }, role: { schema: string, optional: true },
    tokenStart: { schema: integer }, tokenEndExclusive: { schema: integer },
  }) } },
  selections: { schema: { kind: "array", items: object({
    id: { schema: string }, startAnchorId: { schema: string }, endAnchorId: { schema: string },
  }) } },
  moments: { schema: { kind: "array", items: object({
    id: { schema: string }, anchorId: { schema: string },
  }) } },
  anchors: { schema: { kind: "array", minItems: 2, items: semanticAnchor } },
});

export const narrativeMomentSchema: ValueSchema = object({
  narrativeId: { schema: string },
  id: { schema: string },
  anchorId: { schema: string },
});
export const narrativeSelectionSchema: ValueSchema = object({
  narrativeId: { schema: string },
  id: { schema: string },
  startAnchorId: { schema: string }, endAnchorId: { schema: string },
});
