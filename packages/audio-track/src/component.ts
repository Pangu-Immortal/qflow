import type { ComponentPackage } from "@qflow/component-kit";
import type { SynchronizedMedia } from "@qflow/media";
import type { NarrativeMomentRef, NarrativeSelectionRef } from "@qflow/narrative";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import type { SemanticTrack } from "@qflow/semantic-track";
import { projectSemanticProgramSpace } from "@qflow/semantic-track";

import { audioTrackProducers, audioTrackTypes } from "./manifest.js";
import { appendMomentAudioItem, appendProgramAudioItem, appendSelectionAudioItem, assertAudioTrackProgram, createAudioTrackSet, finalizeAudioTrack, renderAudioTrack } from "./program.js";
import type { AudioClipSpec, AudioTrackHeader, AudioTrackProgram, AudioTrackSet } from "./types.js";

function inline<T>(value: StoredValue | undefined, label: string): T {
  if (value?.kind !== "inline") throw new Error(`${label} must be inline.`);
  return value.value as unknown as T;
}
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

const base = (inputs: Parameters<typeof appendProgramAudioItem>) => output(appendProgramAudioItem(...inputs));

export const audioTrackComponent = {
  producers: [
    { producer: audioTrackProducers.createSet, handler: () => ({ outputs: { set: output(createAudioTrackSet()) }, needs: {} }) },
    { producer: audioTrackProducers.appendProgram, handler: ({ inputs }) => ({ outputs: { set: base([
      inline<AudioTrackSet>(inputs.set?.value, "AudioTrackSet"), inline<AudioTrackHeader>(inputs.header?.value, "AudioTrackHeader"),
      inline<SemanticTrack>(inputs.semantic?.value, "SemanticTrack"), inline<SynchronizedMedia>(inputs.media?.value, "SynchronizedMedia"),
      inline<AudioClipSpec>(inputs.spec?.value, "AudioClipSpec"),
    ]) }, needs: {} }) },
    { producer: audioTrackProducers.appendSelection, handler: ({ inputs }) => ({ outputs: { set: output(appendSelectionAudioItem(
      inline<AudioTrackSet>(inputs.set?.value, "AudioTrackSet"), inline<AudioTrackHeader>(inputs.header?.value, "AudioTrackHeader"),
      inline<SemanticTrack>(inputs.semantic?.value, "SemanticTrack"), inline<SynchronizedMedia>(inputs.media?.value, "SynchronizedMedia"),
      inline<NarrativeSelectionRef>(inputs.selection?.value, "NarrativeSelection"),
      inline<AudioClipSpec>(inputs.spec?.value, "AudioClipSpec"),
    )) }, needs: {} }) },
    { producer: audioTrackProducers.appendMoment, handler: ({ inputs }) => ({ outputs: { set: output(appendMomentAudioItem(
      inline<AudioTrackSet>(inputs.set?.value, "AudioTrackSet"), inline<AudioTrackHeader>(inputs.header?.value, "AudioTrackHeader"),
      inline<SemanticTrack>(inputs.semantic?.value, "SemanticTrack"), inline<SynchronizedMedia>(inputs.media?.value, "SynchronizedMedia"),
      inline<NarrativeMomentRef>(inputs.moment?.value, "NarrativeMoment"),
      inline<AudioClipSpec>(inputs.spec?.value, "AudioClipSpec"),
    )) }, needs: {} }) },
    { producer: audioTrackProducers.finalize, handler: ({ inputs }) => ({ outputs: { program: output(finalizeAudioTrack(
      inline<AudioTrackSet>(inputs.set?.value, "AudioTrackSet"), inline<AudioTrackHeader>(inputs.header?.value, "AudioTrackHeader"),
    )) }, needs: {} }) },
    { producer: audioTrackProducers.render, handler: ({ inputs }) => ({ outputs: { track: output(renderAudioTrack(
      projectSemanticProgramSpace(inline<SemanticTrack>(inputs.semantic?.value, "SemanticTrack")), inline<AudioTrackProgram>(inputs.program?.value, "AudioTrackProgram"),
    )) }, needs: {} }) },
  ],
  validators: [{
    type: audioTrackTypes.program,
    handler: ({ value }) => assertAudioTrackProgram(inline<AudioTrackProgram>(value, "AudioTrackProgram")),
  }],
} satisfies ComponentPackage;
