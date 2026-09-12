import { performanceModuleRef, performancePresentId } from "@qflow/performance";
import type { PerformanceSet } from "@qflow/performance";
import { projectTimelineMedia, timelineTypes } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";
import { temporalTypes } from "@qflow/temporal";
import { compositionTypes } from "@qflow/composition";
import { mediaAppearanceStudioFields } from "@qflow/media-track-studio";
import { artifactPreview, authoredChildFor, previewLayer, requiredReferencedValue, requiredSurfaceValue, temporalLineageFor, temporalSemanticSource } from "@qflow/studio-adapter";
import type { StudioTrackCompanion, StudioTrackCompanionContext, StudioEntityDraft, StudioSourceBindingDeclaration } from "@qflow/studio-adapter";

const frameFields = ["left", "top", "right", "bottom", "x", "y", "width", "height"];
const frameBindings: readonly StudioSourceBindingDeclaration[] = frameFields.map(name => ({ name, writable: true }));
// Ordinary Performance uses Timeline playback. The rest is the same Media appearance vocabulary.
const playbackFields = new Set(["playback", "trim-start", "trim-end"]);
const appearanceBindings = mediaAppearanceStudioFields.bindings.filter(field => !playbackFields.has(field.name));
const appearanceInspector = mediaAppearanceStudioFields.inspector.filter(field =>
  !playbackFields.has(field.binding.slice("appearance.".length)));

export function projectPerformance(context: StudioTrackCompanionContext): readonly StudioEntityDraft[] {
  const timeline = requiredReferencedValue(context, "timeline", timelineTypes.track) as Timeline;
  const program = requiredSurfaceValue(context, "program") as PerformanceSet;
  // Source content keeps its own placement. A Use changes its presentation, not its media clock.
  const content: StudioEntityDraft[] = projectTimelineMedia(timeline).flatMap((clip, index) => {
    if (clip.media.visual === undefined) return [];
    return [{
      id: `${context.track.outputRef}:content:${clip.segmentId}`,
      authoredId: clip.segmentId,
      display: { title: clip.segmentId, layers: [previewLayer(artifactPreview("video", clip.media.visual.artifact.resource), "storyboard")] },
      ...clip.span, stackOrder: index,
      inspector: [
        { id: "segment", label: "Segment", domain: "how", section: { id: "content", label: "Content" }, value: clip.segmentId },
        { id: "range", label: "Range", domain: "when", section: { id: "placement", label: "Placement" }, value: `${clip.span.startFrame}–${clip.span.endFrameExclusive}`, unit: "f", summary: "Placed interval; the end frame is exclusive." },
      ],
      presentation: { entity: "performance-content", chrome: "standard" },
    }];
  });
  const uses: StudioEntityDraft[] = program.uses.map((use, index) => {
    const authoredId = use.window.subjectId;
    const child = authoredChildFor(context, authoredId, [temporalTypes.windowSpec]);
    if (child === undefined) throw new Error(`Performance Use ${authoredId} has no author provenance.`);
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
      presentation: { entity: "performance-use", chrome: "standard" },
      band: "uses",
      renderIds: use.visual.presents.map(present => performancePresentId(authoredId, present.id)),
      inspector: [{ id: "range", label: "Range", domain: "when", section: { id: "placement", label: "Placement" }, value: `${use.window.span.startFrame}–${use.window.span.endFrameExclusive}`, unit: "f", summary: "Resolved Use interval; the end frame is exclusive. Timeline gestures follow this Use's author timing." }],
    };
  });
  return [...content, ...uses];
}

export const performanceStudioTrackCompanions: readonly StudioTrackCompanion[] = [{
  id: "visual", role: "track",
  output: { type: compositionTypes.visualTrack, surface: "track", modules: [performanceModuleRef] },
  family: "performance", label: "Performance", tone: "blue", icon: "video",
  lane: { heightPx: 60 },
  requiredValues: ["program"],
  bands: [{
    id: "uses", placement: "after", heightPx: 15, display: "label",
    bindings: [{ name: "style", companion: true }],
    inspector: [{ binding: "style", label: "Style", domain: "how", section: { id: "style", label: "Style" }, control: "text", summary: "The referenced Style is shared by every Use that selects it." }],
  }],
  project: projectPerformance,
}];

export const performanceStudioParameterCompanions: readonly import("@qflow/studio-adapter").StudioParameterCompanion[] = [{
  id: "style", match: { module: performanceModuleRef, surface: "style" },
  bindings: [ { name: "frame", referenced: frameBindings },
    { name: "appearance", recipe: { bindings: appearanceBindings } } ],
  inspector: [
    ...frameFields.map(name => ({ binding: `frame.${name}`, label: name[0]!.toUpperCase() + name.slice(1),
      domain: "where" as const, page: { id: "frame", label: "Frame" }, section: { id: "placement", label: "Placement" },
      control: "number" as const, number: { suffixes: ["%", "px"], step: 1 } })),
    ...appearanceInspector,
  ],
}];
