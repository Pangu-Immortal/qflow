import type { ValueSchema } from "@qflow/protocol";
const number = { kind: "number", minimum: 0 } as const;
const integer = { kind: "number", integer: true, minimum: 0 } as const;
const object = (fields: Readonly<Record<string, { readonly schema: ValueSchema; readonly optional?: boolean }>>): ValueSchema => ({ kind: "object", fields });
const audioBlobRef = object({ kind: { schema: { kind: "literal", value: "blob" } },
  resource: { schema: { kind: "string", minLength: 5, maxLength: 256 } }, size: { schema: integer },
  mediaType: { schema: { kind: "literal", value: "audio/wav" } } });
export const speechDurationSchema: ValueSchema = number;
export const speechEvidenceAudioSchema: ValueSchema = object({ artifact: { schema: audioBlobRef },
  sampleFrames: { schema: { kind: "number", integer: true, minimum: 1 } } });
