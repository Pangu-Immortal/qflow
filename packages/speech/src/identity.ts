import type { SpeechDuration } from "./types.js";

export function sealSpeechDuration(value: SpeechDuration): SpeechDuration { return value; }
export function assertSpeechDurationIdentity(value: SpeechDuration): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error("SpeechDuration is invalid.");
}
