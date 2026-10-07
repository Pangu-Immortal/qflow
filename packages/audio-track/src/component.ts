import type { ProducerPackage } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import type { StoredValue } from "@qflow/qflow/protocol";
import { canonicalize } from "@qflow/qflow/protocol";
import type { SynchronizedMedia } from "@qflow/qflow/media";
import type { TemporalWindow } from "@qflow/qflow/temporal";
import type { Timeline } from "@qflow/qflow/timeline";

import { audioTrackProducers, audioTrackTypes } from "./manifest.js";
import {
  appendAudioClip,
  assertAudioTrackProgram,
  createAudioTrackSet,
  finalizeAudioTrack,
  renderAudioTrack,
} from "./program.js";
import type { AudioClipSpec, AudioTrackHeader, AudioTrackProgram, AudioTrackSet } from "./types.js";

function inline<T>(value: StoredValue | undefined, label: string): T {
  if (value?.kind !== "inline") throw new Error(`${label} must be inline.`);
  return value.value as unknown as T;
}
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

export const audioTrackComponent = {
  producers: [
    { producer: audioTrackProducers.createSet, handler: () => ({ outputs: { set: output(createAudioTrackSet()) }, needs: {} }) },
    { producer: audioTrackProducers.appendClip, handler: ({ inputs }) => ({ outputs: { set: output(
      appendAudioClip(
        inline<AudioTrackSet>(inputs.set?.value, "AudioTrackSet"),
        inline<AudioTrackHeader>(inputs.header?.value, "AudioTrackHeader"),
        inline<Timeline>(inputs.timeline?.value, "Timeline"),
        inline<SynchronizedMedia>(inputs.media?.value, "SynchronizedMedia"),
        inline<AudioClipSpec>(inputs.spec?.value, "AudioClipSpec"),
        inline<TemporalWindow>(inputs.window?.value, "TemporalWindow"),
      ),
    ) }, needs: {} }) },
    { producer: audioTrackProducers.finalize, handler: ({ inputs }) => ({ outputs: { program: output(finalizeAudioTrack(
      inline<AudioTrackSet>(inputs.set?.value, "AudioTrackSet"),
      inline<AudioTrackHeader>(inputs.header?.value, "AudioTrackHeader"),
    )) }, needs: {} }) },
    { producer: audioTrackProducers.render, handler: ({ inputs }) => ({ outputs: { track: output(renderAudioTrack(
      inline<Timeline>(inputs.timeline?.value, "Timeline"),
      inline<AudioTrackProgram>(inputs.program?.value, "AudioTrackProgram"),
    )) }, needs: {} }) },
  ],
  validators: [{
    type: audioTrackTypes.program,
    handler: ({ value }) => assertAudioTrackProgram(inline<AudioTrackProgram>(value, "AudioTrackProgram")),
  }],
} satisfies ProducerPackage & AdmissionPackage;
