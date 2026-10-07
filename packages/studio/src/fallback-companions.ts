import type { StudioTrackCompanion, StudioTrackCompanionContext, StudioEntityDraft } from "@qflow/studio-companion";
import { artifactPreview, previewLayer, temporalLineageFor, temporalDomainSource } from "@qflow/studio-companion";
import { compositionTypes } from "@qflow/qflow/composition";
import { timelineTypes } from "@qflow/qflow/timeline";

type TerminalVisualTrack = {
  readonly presents?: readonly {
    readonly id: string;
    readonly subjectId?: string;
    readonly elements?: readonly {
      readonly kind?: string;
      readonly artifact?: { readonly resource?: string };
    }[];
  }[];
};

type TerminalAudioTrack = {
  readonly clips?: readonly {
    readonly id: string;
    readonly subjectId?: string;
    readonly artifact?: { readonly resource?: string };
  }[];
};

function withTemporalLineage(
  context: StudioTrackCompanionContext,
  entity: StudioEntityDraft,
): StudioEntityDraft {
  const temporal = temporalLineageFor(context, entity.authoredId);
  if (temporal === undefined) return entity;
  const domainSource = temporalDomainSource(temporal);
  return {
    ...entity,
    ...(domainSource?.id === undefined
      ? {}
      : { markerId: domainSource.id }),
    temporal,
  };
}

function projectTerminalVisual(context: StudioTrackCompanionContext): readonly StudioEntityDraft[] {
  const presents = new Map(((context.track.value as TerminalVisualTrack).presents ?? [])
    .map((present) => [present.id, present] as const));
  return context.generic().map((entity) => {
    const present = entity.presentId === undefined ? undefined : presents.get(entity.presentId);
    const material = present?.elements?.find((element) =>
      (element.kind === "image" || element.kind === "video") && element.artifact?.resource !== undefined);
    const resource = material?.artifact?.resource;
    return withTemporalLineage(context, {
      ...entity,
      ...(present?.subjectId === undefined ? {} : { authoredId: present.subjectId }),
      display: {
        title: present?.subjectId ?? entity.display.title,
        layers: resource === undefined ? [] : [previewLayer(artifactPreview(material?.kind === "image" ? "image" : "video", resource), material?.kind === "image" ? "repeat-x" : "storyboard")],
      },
      presentation: { entity: "media-item", chrome: "standard" },
    });
  });
}

function projectTerminalAudio(context: StudioTrackCompanionContext): readonly StudioEntityDraft[] {
  const clips = new Map(((context.track.value as TerminalAudioTrack).clips ?? [])
    .map((clip) => [clip.id, clip] as const));
  return context.generic().map((entity, index) => {
    const clip = clips.get(context.spans[index]?.id ?? "");
    const resource = clip?.artifact?.resource;
    return withTemporalLineage(context, {
      ...entity,
      ...(clip?.subjectId === undefined ? {} : { authoredId: clip.subjectId }),
      display: {
        title: clip?.subjectId ?? entity.display.title,
        layers: resource === undefined ? [] : [previewLayer(artifactPreview("audio", resource), "waveform")],
      },
      presentation: { entity: "audio-clip", chrome: "standard" },
    });
  });
}

/** Cross-domain terminal protocols understood even when no Companion is installed. */
export const fallbackStudioTrackCompanions: readonly StudioTrackCompanion[] = [
  {
    id: "@qflow/studio#timeline", role: "timeline", output: { type: timelineTypes.timeline },
    family: "timeline", tone: "teal", label: "Timeline", icon: "brand",
    lane: { heightPx: 45 },
  },
  {
    id: "@qflow/studio#audio-track", role: "track", output: { type: compositionTypes.audioTrack },
    family: "audio", tone: "green", icon: "waveform",
    project: projectTerminalAudio,
    lane: { heightPx: 48 },
  },
  {
    id: "@qflow/studio#visual-track", role: "track", output: { type: compositionTypes.visualTrack },
    family: "media", tone: "blue", icon: "video",
    project: projectTerminalVisual,
    lane: { heightPx: 76 },
  },
];
