import type { ValueSchema } from "@qflow/qflow/protocol";

const string = { kind: "string", minLength: 1 } as const;
const integer = { kind: "number", integer: true, minimum: 0 } as const;
const object = (fields: Readonly<Record<string, { readonly schema: ValueSchema; readonly optional?: boolean }>>): ValueSchema => ({ kind: "object", fields });
const token = object({ tokenId: { schema: string }, segmentId: { schema: string }, text: { schema: string },
  startBoundaryId: { schema: string }, endBoundaryId: { schema: string } });
const boundary = object({ id: { schema: string }, frame: { schema: integer } });
const segment = object({ segmentId: { schema: string }, startBoundaryId: { schema: string }, endBoundaryId: { schema: string } });

export const narrativeAlignmentSchema: ValueSchema = object({
  narrativeId: { schema: string }, domainId: { schema: string }, segment: { schema: segment },
  tokens: { schema: { kind: "array", items: token } }, boundaries: { schema: { kind: "array", items: boundary } },
});
