import { soundModuleRef } from "@qflow/sound";
import type { SoundSet } from "@qflow/sound";
import { projectTimelineMedia, timelineTypes } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";
import { temporalTypes } from "@qflow/temporal";
import { compositionTypes } from "@qflow/composition";
import { artifactPreview, authoredChildFor, previewLayer, requiredReferencedValue, requiredSurfaceValue, temporalLineageFor, temporalSemanticSource } from "@qflow/studio-adapter";
import type { StudioTrackCompanion, StudioTrackCompanionContext, StudioEntityDraft } from "@qflow/studio-adapter";

export function projectSound(context: StudioTrackCompanionContext): readonly StudioEntityDraft[] {
  const timeline = requiredReferencedValue(context, "timeline", timelineTypes.track) as Timeline;
  const program = requiredSurfaceValue(context, "program") as SoundSet;
  // Source content keeps its own placement. A Use changes its presentation, not its media clock.
  const content: StudioEntityDraft[] = projectTimelineMedia(timeline).flatMap((clip, index) => {
    if (clip.media.audio === undefined) return [];
    return [{
      id: `${context.track.outputRef}:content:${clip.segmentId}`,
      authoredId: clip.segmentId,
      display: { title: clip.segmentId, layers: [previewLayer(artifactPreview("audio", clip.media.audio.artifact.resource), "waveform")] },
      ...clip.span, stackOrder: index,
      inspector: [
        { id: "segment", label: "Segment", domain: "how", section: { id: "content", label: "Content" }, value: clip.segmentId },
        { id: "range", label: "Range", domain: "when", section: { id: "placement", label: "Placement" }, value: `${clip.span.startFrame}–${clip.span.endFrameExclusive}`, unit: "f", summary: "Placed interval; the end frame is exclusive." },
      ],
      presentation: { entity: "sound-content", chrome: "standard" },
    }];
  });
  const uses: StudioEntityDraft[] = program.uses.map((use, index) => {
    const authoredId = use.window.subjectId;
    const child = authoredChildFor(context, authoredId, [temporalTypes.windowSpec]);
    if (child === undefined) throw new Error(`Sound Use ${authoredId} has no author provenance.`);
    const style = child.referenceAttributes.style;
    const temporal = temporalLineageFor(context, authoredId, "window");
    const semantic = temporalSemanticSource(temporal);
    return {
      id: `${context.track.outputRef}:use:${authoredId}`, authoredId,
      display: { title: style ?? authoredId, layers: [] },
      ...use.window.span, stackOrder: index,
      elementRange: child.range,
      ...(temporal === undefined ? {} : { temporal }),
      ...(semantic === undefined ? {} : { markerId: semantic.id }),
      presentation: { entity: "sound-use", chrome: "standard" },
      band: "uses",
      inspector: [{ id: "range", label: "Range", domain: "when", section: { id: "placement", label: "Placement" }, value: `${use.window.span.startFrame}–${use.window.span.endFrameExclusive}`, unit: "f", summary: "Resolved Use interval; the end frame is exclusive. Timeline gestures follow this Use's author timing." }],
    };
  });
  return [...content, ...uses];
}

export const soundStudioTrackCompanions: readonly StudioTrackCompanion[] = [{
  id: "audio", role: "track",
  output: { type: compositionTypes.audioTrack, surface: "track", modules: [soundModuleRef] },
  family: "sound", label: "Sound", tone: "green", icon: "waveform",
  lane: { heightPx: 48 },
  requiredValues: ["program"],
  bands: [{
    id: "uses", placement: "after", heightPx: 15, display: "label",
    bindings: [{ name: "style", companion: true }],
    inspector: [{ binding: "style", label: "Style", domain: "how", section: { id: "sound", label: "Sound" }, control: "text", summary: "This Style is shared by every Use that selects it." }],
  }],
  project: projectSound,
}];

export const soundStudioParameterCompanions: readonly import("@qflow/studio-adapter").StudioParameterCompanion[] = [{
  id: "style", match: { module: soundModuleRef, surface: "style" },
  bindings: [ { name: "gain", writable: true, fallback: 1 },
    { name: "end-gain", writable: true, fallback: authored => Number(authored.gain ?? 1) } ],
  inspector: (["gain", "end-gain"] as const).map(name => ({
    binding: name, label: name === "gain" ? "Gain" : "End Gain", domain: "how",
    section: { id: "sound", label: "Sound" }, control: "number", unit: "%",
    number: { scale: 100, minimum: 0, maximum: 6400, step: 1 },
    summary: name === "gain" ? "Linear gain at the start of each Use. 100% preserves the source level." : "Linear gain at the end of each Use. The Use interval owns the ramp.",
  })),
}];
