import type { ValueSchema } from "@qflow/qflow/protocol";

const string = { kind: "string", minLength: 1 } as const;
const object = (
  fields: Readonly<Record<string, { readonly schema: ValueSchema; readonly optional?: boolean }>>,
): ValueSchema => ({ kind: "object", fields });

export const narrativeCaptionBindingSchema: ValueSchema = object({
  id: { schema: string }, narrativeId: { schema: string }, documentId: { schema: string },
  units: { schema: { kind: "array", items: object({
    unitId: { schema: string }, sourceTokenIds: { schema: { kind: "array", minItems: 1, items: string } },
  }) } },
});
