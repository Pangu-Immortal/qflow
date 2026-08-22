import { assertSpeechEvidenceAudioIdentity } from "@qflow/speech";
import type { SpeechEvidenceAudio } from "@qflow/speech";
import type { WhisperXAlignmentRequest, WhisperXLanguage } from "./types.js";

export function whisperXRequestForEvidenceAudio(
  evidence: SpeechEvidenceAudio,
  options: { readonly language: WhisperXLanguage },
): WhisperXAlignmentRequest {
  assertSpeechEvidenceAudioIdentity(evidence);
  return {
    audio: evidence.artifact,
    sampleFrames: evidence.sampleFrames,
    language: options.language,
  };
}
