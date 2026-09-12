import { compositionDependency, compositionTypes } from "@qflow/composition";
import { timelineDependency, timelineTypes } from "@qflow/timeline";
import { temporalDependency, temporalTypes } from "@qflow/temporal";
import { temporalWindowAttributeVocabulary } from "@qflow/temporal-markup";
import type { ModuleManifest, ProducerRef, TypeRef } from "@qflow/protocol";

export const soundModuleRef = { name: "@qflow/sound", version: "1" } as const;
export const soundTypes = Object.fromEntries(["Style", "Set", "Header", "Gain"].map(name => [name.toLowerCase(), { module: soundModuleRef, name: `Sound${name}` }])) as Record<"style" | "set" | "header" | "gain", TypeRef>;
export const soundProducers = Object.fromEntries(["create", "append", "resolve", "ordinary"].map(name => [name, { module: soundModuleRef, name }])) as Record<"create" | "append" | "resolve" | "ordinary", ProducerRef>;
export const ordinaryInputs = [
  { name: "timeline", type: timelineTypes.track }, { name: "window", type: temporalTypes.window },
  { name: "spec", type: soundTypes.gain },
];
export const soundManifest: ModuleManifest = {
  format: "qflow.module@1", ...soundModuleRef,
  dependencies: [compositionDependency, timelineDependency, temporalDependency],
  types: Object.values(soundTypes).map(type => ({ name: type.name })), capabilities: [],
  producers: [
    { name: "create", inputs: [], outputs: [{ name: "set", type: soundTypes.set }], needs: [] },
    { name: "append", inputs: [{ name: "set", type: soundTypes.set }, { name: "window", type: temporalTypes.window }, { name: "audio", type: compositionTypes.audioTrack }], outputs: [{ name: "set", type: soundTypes.set }], needs: [] },
    { name: "resolve", inputs: [{ name: "set", type: soundTypes.set }, { name: "timeline", type: timelineTypes.track }, { name: "header", type: soundTypes.header }], outputs: [{ name: "audio", type: compositionTypes.audioTrack }], needs: [] },
    { name: "ordinary", inputs: ordinaryInputs, outputs: [{ name: "audio", type: compositionTypes.audioTrack }], needs: [] },
  ],
};
export const soundMarkupSurfaces = [
  { name: "style", tag: "Style", mode: "structured", outputs: [soundTypes.style, soundTypes.gain], vocabulary: {
    summary: "Presents existing Timeline sound, choosing the last declared active audio source. Gain may change linearly across each Use.",
    example: `<sound:Style id="fade-in" gain="0" end-gain="1"/>`,
    attributes: [
      { name: "id", kind: "identifier", required: true, summary: "Style name." },
      { name: "gain", kind: "literal", required: false, summary: "Linear gain at the beginning of a Use; defaults to 1. Zero silences the presentation." },
      { name: "end-gain", kind: "literal", required: false, summary: "Linear gain at the end of a Use; defaults to gain. The original Use interval owns the ramp." },
    ],
  } },
  { name: "track", tag: "Track", mode: "structured", outputs: [compositionTypes.audioTrack, soundTypes.set, soundTypes.header, temporalTypes.instantSpec, temporalTypes.windowSpec, temporalTypes.instant, temporalTypes.window], vocabulary: {
    summary: "Presents Timeline sound through ordered Uses. Later Uses replace earlier presentation locally without restarting source playback or gain curves.",
    example: `<sound:Track id="voice" timeline={program.timeline}><sound:Use style={normal}/><sound:Use at="0f" for="2s" style={fade-in}/></sound:Track>`,
    attributes: [
      { name: "id", kind: "identifier", required: true, summary: "Sound presentation name." },
      { name: "timeline", kind: "reference", required: true, accepts: [timelineTypes.track], summary: "Complete film time and placed sources." },
    ], children: [{ tag: "Use", cardinality: "many", summary: "Last matching Use wins, including silence. No time selector covers the complete Timeline.", attributes: [
      { name: "id", kind: "identifier", required: false, summary: "Optional occurrence identity." },
      { name: "style", kind: "reference", required: true, accepts: [soundTypes.style], summary: "Ordinary or project-authored sound Style. Explicit source bindings belong to the Style." },
      ...temporalWindowAttributeVocabulary,
    ] }],
  } },
] as const;
