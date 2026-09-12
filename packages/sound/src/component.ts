import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import type { ComponentPackage } from "@qflow/component-kit";
import type { Timeline } from "@qflow/timeline";
import type { AudioTrack } from "@qflow/composition";
import type { TemporalWindow } from "@qflow/temporal";
import { ordinarySound, appendSoundUse, resolveSound } from "./program.js";
import type { SoundSet, SoundGain } from "./program.js";
import { soundProducers } from "./manifest.js";
function inline<T>(value: StoredValue | undefined): T {
  if (value?.kind !== "inline") throw new Error("Sound input must be inline.");
  return value.value as unknown as T;
}
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });
export const soundComponent: ComponentPackage = {
  producers: [
    { producer: soundProducers.create, handler: () => ({ outputs: { set: output({ uses: [] }) }, needs: {} }) },
    { producer: soundProducers.append, handler: ({ inputs }) => ({ outputs: { set: output(appendSoundUse(
      inline<SoundSet>(inputs.set?.value), inline<TemporalWindow>(inputs.window?.value), inline<AudioTrack>(inputs.audio?.value),
    )) }, needs: {} }) },
    { producer: soundProducers.resolve, handler: ({ inputs }) => ({ outputs: { audio: output(resolveSound(
      inline<Timeline>(inputs.timeline?.value), inline<{ id: string }>(inputs.header?.value).id, inline<SoundSet>(inputs.set?.value),
    )) }, needs: {} }) },
    { producer: soundProducers.ordinary, handler: ({ inputs }) => ({ outputs: { audio: output(ordinarySound(
      inline<Timeline>(inputs.timeline?.value), inline<TemporalWindow>(inputs.window?.value), inline<SoundGain>(inputs.spec?.value),
    )) }, needs: {} }) },
  ],
};
