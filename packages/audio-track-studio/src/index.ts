import { audioItemDefaults, audioTrackModuleRef, audioTrackTypes } from "@qflow/audio-track";
import type { AudioTrackProgram } from "@qflow/audio-track";
import { compositionTypes } from "@qflow/composition";
import type { StudioTrackCompanion, StudioTrackCompanionContext, StudioEntityDraft } from "@qflow/studio-adapter";
import { artifactPreview, authoredItemTitle, childEntities, previewLayer, requiredSurfaceValue, temporalLineageFor, temporalSemanticSource } from "@qflow/studio-adapter";

function projectAudio(context: StudioTrackCompanionContext): readonly StudioEntityDraft[] {
  const program = requiredSurfaceValue(context, "program") as AudioTrackProgram;
  const items = program.items.map((item) => ({
    id: item.id,
    subjectId: item.subjectId,
    startFrame: item.window.startFrame,
    endFrameExclusive: item.window.endFrameExclusive,
    stackOrder: Number.MIN_SAFE_INTEGER,
    sourceTypes: [audioTrackTypes.clipSpec],
    preview: artifactPreview("audio", item.source.artifact.resource),
  }));
  return childEntities(context, items, "audio-clip", "standard").map((entity, index) => {
    const item = items[index]!;
    const temporal = temporalLineageFor(context, item.id, "window");
    const semanticSource = temporalSemanticSource(temporal);
    return {
      ...entity,
      display: {
        title: authoredItemTitle(context, entity.authoredId, item.sourceTypes, ["source"]),
        layers: [previewLayer(item.preview, "waveform")],
      },
      ...(semanticSource?.id === undefined
        ? {}
        : { markerId: semanticSource.id }),
      ...(temporal === undefined ? {} : { temporal }),
    };
  });
}

export const audioTrackStudioTrackCompanions: readonly StudioTrackCompanion[] = [
  {
    id: "track", role: "track",
    output: { type: compositionTypes.audioTrack, surface: "track", modules: [audioTrackModuleRef] },
    family: "audio", tone: "green", icon: "waveform",
    bindings: [
      { name: "source" },
      { name: "trim-start", writable: true },
      { name: "trim-end", writable: true },
      { name: "playback-settings", writable: true,
        attributes: ["playback", "min-rate", "max-rate"],
        fallback: { playback: audioItemDefaults.playback },
        schema: { kind: "oneOf", variants: ["once", "once-start", "once-end", "loop", "loop-start", "loop-end", "stretch"].map(mode => ({
          kind: "object", fields: {
            playback: { schema: { kind: "literal", value: mode } },
            ...(mode === "stretch" ? {
              "min-rate": { schema: { kind: "number", minimum: 0, maximum: 100 } },
              "max-rate": { schema: { kind: "number", minimum: 0, maximum: 100 } },
            } : {}),
          },
        })) },
      },
      { name: "gain", writable: true, fallback: audioItemDefaults.gain },
      { name: "fade-in", writable: true, fallback: audioItemDefaults["fade-in"] },
      { name: "fade-out", writable: true, fallback: audioItemDefaults["fade-out"] },
    ],
    inspector: [
      {
        binding: "playback-settings", label: "Playback", domain: "when",
        page: { id: "playback", label: "Playback" }, section: { id: "playback", label: "Playback" },
        control: "record",
        summary: "Rates are multipliers (1 = original speed). Stretch requires both rate bounds.",
      },
      ...(["trim-start", "trim-end"] as const).map((binding) => ({
        binding, label: binding === "trim-start" ? "Trim Start" : "Trim End", domain: "when" as const,
        page: { id: "playback", label: "Playback" }, section: { id: "trim", label: "Trim" }, control: "number" as const,
        number: { suffixes: ["ms", "s", "f"], minimum: 0 },
      })),
      { binding: "gain", label: "Gain", domain: "how",
        page: { id: "mix", label: "Mix" }, section: { id: "mix", label: "Mix" },
        control: "number", unit: "%", number: { scale: 100, minimum: 0, maximum: 6400, step: 1 } },
      ...(["fade-in", "fade-out"] as const).map((binding) => ({
        binding, label: binding === "fade-in" ? "Fade In" : "Fade Out", domain: "when" as const,
        page: { id: "fade", label: "Fade" }, section: { id: "fade", label: "Fade" }, control: "number" as const,
        number: { suffixes: ["ms", "s", "f"], minimum: 0 },
      })),
    ],
    requiredValues: ["program"], project: projectAudio,
    lane: { heightPx: 48 },
  },
];
