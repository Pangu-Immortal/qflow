import { isResourceId } from "@qflow/protocol";
import type { BlobRef, ModuleManifest, TypeRef, ValueSchema } from "@qflow/protocol";

export type SpeechEvidenceAudio = {
  /** The exact local temporal domain from which this evidence audio was projected. */
  readonly domainId: string;
  readonly artifact: BlobRef;
  /** Exact 16 kHz mono PCM sample count. */
  readonly sampleFrames: number;
};

/** Exact boundaries in the fixed 16 kHz Speech Evidence Audio sample domain. */
export type SpeechWordEvidence = {
  readonly text: string;
  readonly startSample?: number;
  readonly endSampleExclusive?: number;
  readonly score?: number;
};

export type SpeechCharacterEvidence = {
  readonly char: string;
  /** Index into the containing passage's words. */
  readonly wordIndex: number;
  readonly startSample?: number;
  readonly endSampleExclusive?: number;
  readonly score?: number;
};

export type SpeechActivitySpan = {
  readonly startSample: number;
  readonly endSampleExclusive: number;
};

/**
 * One acoustic passage reported by the evidence provider. It deliberately has
 * no authored Segment identity; assigning evidence to the explicitly connected
 * Script Segment belongs to the later deterministic Speech Alignment step.
 */
export type SpeechTranscriptPassage = {
  readonly startSample?: number;
  readonly endSampleExclusive?: number;
  readonly words: readonly SpeechWordEvidence[];
  readonly chars: readonly SpeechCharacterEvidence[];
  readonly speechActivity?: readonly SpeechActivitySpan[];
};

export type AlignedTranscriptEvidence = {
  readonly domainId: string;
  readonly sampleFrames: number;
  readonly passages: readonly SpeechTranscriptPassage[];
};

const sample = { kind: "number", integer: true, minimum: 0 } as const;
const integer = { kind: "number", integer: true, minimum: 0 } as const;
const score = { kind: "number", minimum: 0, maximum: 1 } as const;
const object = (
  fields: Readonly<Record<string, { readonly schema: ValueSchema; readonly optional?: boolean }>>,
): ValueSchema => ({ kind: "object", fields });

const word = object({
  text: { schema: { kind: "string" } },
  startSample: { schema: sample, optional: true },
  endSampleExclusive: { schema: sample, optional: true },
  score: { schema: score, optional: true },
});
const char = object({
  char: { schema: { kind: "string" } },
  wordIndex: { schema: integer },
  startSample: { schema: sample, optional: true },
  endSampleExclusive: { schema: sample, optional: true },
  score: { schema: score, optional: true },
});
const activity = object({
  startSample: { schema: sample },
  endSampleExclusive: { schema: sample },
});

export const alignedTranscriptEvidenceFields = {
  domainId: { schema: { kind: "string", minLength: 1 } },
  sampleFrames: { schema: { kind: "number", integer: true, minimum: 1 } },
  passages: {
    schema: {
      kind: "array",
      items: object({
        startSample: { schema: sample, optional: true },
        endSampleExclusive: { schema: sample, optional: true },
        words: { schema: { kind: "array", items: word } },
        chars: { schema: { kind: "array", items: char } },
        speechActivity: { schema: { kind: "array", items: activity }, optional: true },
      }),
    },
  },
} as const satisfies Readonly<Record<string, { readonly schema: ValueSchema; readonly optional?: boolean }>>;

export const alignedTranscriptEvidenceSchema: ValueSchema = object(alignedTranscriptEvidenceFields);
export const speechEvidenceModuleRef = { name: "@qflow/speech-evidence", version: "1" } as const;
export const speechEvidenceTypes = {
  audio: { module: speechEvidenceModuleRef, name: "SpeechEvidenceAudio" },
  alignedTranscript: { module: speechEvidenceModuleRef, name: "AlignedTranscriptEvidence" },
} satisfies Record<string, TypeRef>;
export const speechEvidenceManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: speechEvidenceModuleRef.name,
  version: speechEvidenceModuleRef.version,
  dependencies: [],
  types: [{ name: speechEvidenceTypes.audio.name }, { name: speechEvidenceTypes.alignedTranscript.name }],
  capabilities: [],
  producers: [],
};
export const speechEvidenceDependency = {
  module: speechEvidenceModuleRef,
} as const;

export function sealAlignedTranscriptEvidence(value: AlignedTranscriptEvidence): AlignedTranscriptEvidence {
  return structuredClone(value);
}

export function speechEvidenceSampleBoundary(masterSampleBoundary: number): number {
  if (!Number.isSafeInteger(masterSampleBoundary) || masterSampleBoundary < 0) {
    throw new Error("Speech evidence source sample boundary is invalid.");
  }
  const value = (BigInt(masterSampleBoundary) * 16_000n * 2n + 48_000n) / (48_000n * 2n);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Speech evidence sample boundary exceeds safe arithmetic.");
  return Number(value);
}

export function sealSpeechEvidenceAudio(value: SpeechEvidenceAudio): SpeechEvidenceAudio {
  return structuredClone(value);
}

export function assertSpeechEvidenceAudioIdentity(value: SpeechEvidenceAudio): void {
  if (typeof value.domainId !== "string" || value.domainId.length === 0
    || value.artifact.kind !== "blob" || !isResourceId(value.artifact.resource)
    || !Number.isSafeInteger(value.artifact.size) || value.artifact.size < 0 || value.artifact.mediaType !== "audio/wav"
    || !Number.isSafeInteger(value.sampleFrames) || value.sampleFrames < 1) {
    throw new Error("SpeechEvidenceAudio identity is invalid.");
  }
}

export function assertAlignedTranscriptEvidenceIdentity(value: AlignedTranscriptEvidence): void {
  if (typeof value.domainId !== "string" || value.domainId.length === 0
    || !Number.isSafeInteger(value.sampleFrames) || value.sampleFrames < 1
    || !Array.isArray(value.passages)) {
    throw new Error("AlignedTranscriptEvidence identity is invalid.");
  }
}
