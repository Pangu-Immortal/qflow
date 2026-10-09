import type { ValueSchema } from "@qflow/qflow/protocol";
import { spatialFrameSchema } from "@qflow/spatial";

const object = (fields: Readonly<Record<string, { readonly schema: ValueSchema; readonly optional?: boolean }>>): ValueSchema => ({ kind: "object", fields });

export const regionEvidenceSchema = object({
  timelineId: { schema: { kind: "string", minLength: 1 } },
  series: { schema: { kind: "array", minItems: 1, items: object({
    id: { schema: { kind: "string", minLength: 1 } },
    frames: { schema: { kind: "array", minItems: 1, items: {
      kind: "oneOf", variants: [spatialFrameSchema, { kind: "null" }],
    } } },
  }) } },
});
