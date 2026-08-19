import { assertSpeechEvidenceAudioIdentity } from "@qflow/speech";
import type { SpeechEvidenceAudio } from "@qflow/speech";
import type { WhisperXAlignmentRequest } from "./types.js";

export function whisperXRequestForEvidenceAudio(
  evidence: SpeechEvidenceAudio,
  options: { readonly language?: string } = {},
): WhisperXAlignmentRequest {
  assertSpeechEvidenceAudioIdentity(evidence);
  return {
    audio: evidence.artifact,
    sampleFrames: evidence.sampleFrames,
    ...(options.language === undefined ? {} : { language: options.language }),
  };
}
