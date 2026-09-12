import { sealGraphFragment } from "@qflow/elaborator";
import type { GraphFragment } from "@qflow/elaborator";
import { compositionTypes } from "@qflow/composition";
import { timelineTypes } from "@qflow/timeline";
import { temporalTypes } from "@qflow/temporal";
import { sameType } from "@qflow/protocol";
import type { SurfaceResolvedReference } from "@qflow/markup";

/** Author-time closure: bound references become ordinary graph edges at each Use. */
export type SoundStyle = {
  readonly fragment: GraphFragment;
  readonly bindings: Readonly<Record<string, { readonly type: SurfaceResolvedReference["type"]; readonly ref: SurfaceResolvedReference["ref"] }>>;
};
export function soundStyle(fragment: GraphFragment, bindings: SoundStyle["bindings"] = {}): SoundStyle {
  fragment = sealGraphFragment(fragment);
  const common = { timeline: timelineTypes.track, window: temporalTypes.window };
  for (const [name, type] of Object.entries(common)) {
    const port = fragment.inputs.find(port => port.name === name);
    if (port === undefined || !sameType(port.type, type)) throw new Error(`Sound Style requires ${name} input.`);
    if (bindings[name] !== undefined) throw new Error(`Sound supplies ${name} at each Use.`);
  }
  for (const port of fragment.inputs) {
    if (port.name in common) continue;
    const binding = bindings[port.name];
    if (binding === undefined || !sameType(port.type, binding.type)) throw new Error(`Sound Style binding ${port.name} has the wrong Type.`);
  }
  for (const name of Object.keys(bindings)) {
    if (!fragment.inputs.some(port => port.name === name)) throw new Error(`Sound Style has unknown binding ${name}.`);
  }
  if (fragment.exports.length !== 1 || fragment.exports[0]?.name !== "audio" || !sameType(fragment.exports[0].type, compositionTypes.audioTrack)) {
    throw new Error("Sound Style must export audio: AudioTrack.");
  }
  return { fragment, bindings: Object.fromEntries(Object.entries(bindings).map(([name, value]) => [name, { ref: value.ref, type: value.type }])) };
}
