import type { SpeechEvidenceAudio } from "@qflow/speech";

export type WhisperXLanguage = "en" | "zh" | "es";

export type WhisperXAlignmentRequest = {
  readonly audio: SpeechEvidenceAudio["artifact"];
  readonly sampleFrames: number;
  readonly language: WhisperXLanguage;
};
