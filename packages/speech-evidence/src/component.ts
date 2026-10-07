import type { AdmissionPackage } from "@qflow/admission";
import { plannedNeedInputs } from "@qflow/producer";
import type { ProducerPackage } from "@qflow/producer";
import { synchronizedMediaSampleFrames, verifySynchronizedMedia } from "@qflow/media";
import type { SynchronizedMedia } from "@qflow/media";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import { assertLocalTemporalDomain } from "@qflow/temporal";
import type { LocalTemporalDomain } from "@qflow/temporal";

import {
  assertAlignedTranscriptEvidenceIdentity,
  assertSpeechEvidenceAudioIdentity,
  speechEvidenceCapabilities,
  speechEvidenceProducers,
  speechEvidenceSampleBoundary,
  speechEvidenceTypes,
} from "./index.js";
import type { AlignedTranscriptEvidence, ProjectSpeechEvidenceAudioNeed, SpeechEvidenceAudio } from "./index.js";

function inline<T>(value: StoredValue, subject: string): T {
  if (value.kind !== "inline") throw new Error(`${subject} must be inline.`);
  return value.value as T;
}

export const speechEvidenceComponent = {
  validators: [
    { type: speechEvidenceTypes.audio,
      handler: ({ value }) => assertSpeechEvidenceAudioIdentity(inline<SpeechEvidenceAudio>(value, "SpeechEvidenceAudio")) },
    { type: speechEvidenceTypes.alignedTranscript,
      handler: ({ value }) => assertAlignedTranscriptEvidenceIdentity(inline<AlignedTranscriptEvidence>(value, "AlignedTranscriptEvidence")) },
  ],
  producers: [{
    producer: speechEvidenceProducers.projectAudio,
    handler: ({ inputs }) => {
      const media = inline<SynchronizedMedia>(inputs.media!.value, "SynchronizedMedia");
      const domain = inline<LocalTemporalDomain>(inputs.domain!.value, "LocalTemporalDomain");
      verifySynchronizedMedia(media);
      assertLocalTemporalDomain(domain);
      if (domain.frameCount !== media.frameDomain.frameCount
        || domain.frameRate.numerator !== media.frameDomain.frameRate.numerator
        || domain.frameRate.denominator !== media.frameDomain.frameRate.denominator) {
        throw new Error(`Speech evidence domain ${domain.id} does not describe its normalized media`);
      }
      if (media.audio === undefined) throw new Error("Speech evidence requires normalized media audio");
      const sourceSampleFrames = synchronizedMediaSampleFrames(media);
      const evidenceSampleFrames = speechEvidenceSampleBoundary(sourceSampleFrames);
      if (!Number.isSafeInteger(sourceSampleFrames) || sourceSampleFrames < 1
        || !Number.isSafeInteger(evidenceSampleFrames) || evidenceSampleFrames < 1) {
        throw new Error("Speech evidence audio sample domain is invalid");
      }
      const need: ProjectSpeechEvidenceAudioNeed = {
        domainId: domain.id,
        source: media.audio.artifact,
        sourceSampleFrames,
        evidenceSampleFrames,
      };
      return { outputs: {}, needs: { evidenceAudio: canonicalize(need) } };
    },
  }],
  plannedNeeds: [{
    producer: speechEvidenceProducers.projectAudio,
    port: "evidenceAudio",
    capability: speechEvidenceCapabilities.projectAudio,
    plan({ state, step }) {
      return { constraints: {}, pendingInputs: plannedNeedInputs(state, step, { media: "audio" }) };
    },
    present(specification) {
      const audio = specification.pendingInputs.filter((item) => item.role === "audio").length;
      return { fields: {}, references: audio === 0 ? {} : { audio } };
    },
  }],
} satisfies ProducerPackage & AdmissionPackage;
