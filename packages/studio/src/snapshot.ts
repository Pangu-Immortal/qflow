import { composeParameterDeclarations } from "./parameters.js";
/**
 * Turn the resolved Studio projection into what the panels read.
 *
 * The Timeline owns the work range. Companions project selectable entities onto
 * that range without extending it or requiring component-specific editor code.
 */
import { relative } from "node:path";

import type { MarkupSurfaceRegistryLike } from "@qflow/qflow/markup";
import { compositionTypes } from "@qflow/qflow/composition";
import { timelineFrameCount } from "@qflow/qflow/timeline";
import { sameModule, sameType } from "@qflow/qflow/protocol";

import type {
  CandidateProvenance,
  Clip,
  StudioSnapshot,
  Range,
  TemporalDomainView,
  Track,
} from "./shared.js";
import type { Placement } from "./observe.js";
import type { StudioProjection } from "./projection.js";
import {
  sealStudioClip,
} from "./studio-registry.js";
import type { StudioCompanionRegistry } from "./studio-registry.js";
import type { StudioEntityDraft } from "./studio-registry.js";
import { inspectorFieldsForBindings, resolveTimelineEditHandles, sourceBindingsForDraft, temporalBindingDeclarations } from "./parameters.js";
import type { StudioSourceFile } from "./parameters.js";

type Present = {
  readonly id: string;
  readonly subjectId?: string;
  readonly span: { readonly startFrame: number; readonly endFrameExclusive: number };
  readonly z: number;
};

/** Sound is placed in samples rather than frames, in the canonical 48 kHz. */
const SAMPLE_RATE = 48_000;

type AudioClip = {
  readonly id: string;
  readonly subjectId?: string;
  readonly target: { readonly startSample: number; readonly endSampleExclusive: number };
};

/**
 * Both kinds of Track say the same thing in their own domain: a named span.
 * Reading them into one shape is what lets the timeline hold both without
 * knowing which package made either.
 */
function spans(
  track: unknown,
  frameRate: { readonly numerator: number; readonly denominator: number },
): readonly { id: string; subjectId?: string; startFrame: number; endFrameExclusive: number; stackOrder: number }[] {
  const held = track as { presents?: readonly Present[]; clips?: readonly AudioClip[] } | undefined;
  if (held?.presents !== undefined) {
    return held.presents.map((present) => ({
      id: present.id,
      ...(present.subjectId === undefined ? {} : { subjectId: present.subjectId }),
      startFrame: present.span.startFrame,
      endFrameExclusive: present.span.endFrameExclusive,
      stackOrder: present.z,
    }));
  }
  const perSecond = frameRate.numerator / frameRate.denominator;
  return (held?.clips ?? []).map((clip) => ({
    id: clip.id,
    ...(clip.subjectId === undefined ? {} : { subjectId: clip.subjectId }),
    startFrame: Math.floor(clip.target.startSample / SAMPLE_RATE * perSecond),
    endFrameExclusive: Math.max(
      Math.floor(clip.target.startSample / SAMPLE_RATE * perSecond) + 1,
      Math.ceil(clip.target.endSampleExclusive / SAMPLE_RATE * perSecond),
    ),
    // Sound is under every picture, so it sits at the bottom of the timeline.
    stackOrder: Number.MIN_SAFE_INTEGER,
  }));
}

/** Where an authored id was written, whatever kind of thing it names. */
type Located = { readonly id: string; readonly range: Range };

function authored(placements: readonly Placement[]): readonly Located[] {
  const found: Located[] = [];
  for (const placement of placements) {
    if (placement.id !== undefined) found.push({ id: placement.id, range: placement.range });
    for (const child of placement.children) {
      if (child.id !== undefined) found.push({ id: child.id, range: child.range });
    }
  }
  return found;
}

/** Package Companions project their own temporal facts onto Studio's absolute ruler. */
function temporalDomains(
  registry: StudioCompanionRegistry,
  built: StudioProjection,
): readonly TemporalDomainView[] {
  const provenance: CandidateProvenance = {
    output: built.timingOutput?.name ?? "Timeline",
    ...(built.timingOutput?.ref === undefined ? {} : { outputRef: built.timingOutput.ref }),
    ...(built.timingCandidateId === undefined ? {} : { candidateId: built.timingCandidateId }),
    origin: built.timingCandidateOrigin,
    status: "resolved",
    errors: [],
  };
  return built.source.observations.temporalDomains.flatMap((source) => {
    const projected = registry.projectTemporalDomain({ source, values: built.temporalDomainValues, timeline: built.timeline });
    if (projected === undefined || projected.timelineId !== built.timeline.id) return [];
    return [{ ...projected, companion: source.companion,
      presentation: registry.temporalDomainPresentation(source.companion), provenance,
      source: { path: source.sourcePath, content: source.content } }];
  });
}

export function snapshot(registry: StudioCompanionRegistry, built: StudioProjection, input: {
  readonly revision: number;
  readonly path: string;
  readonly text: string;
  readonly run: StudioSnapshot["run"];
  readonly canvas: { readonly width: number; readonly height: number; readonly clearColor: string };
  readonly frameRate: { readonly numerator: number; readonly denominator: number };
  readonly preview: StudioSnapshot["preview"];
  readonly workspaceRoot: string;
  readonly sourceFiles: readonly StudioSourceFile[];
  readonly surfaces: MarkupSurfaceRegistryLike;
}): StudioSnapshot {
  const located = authored(built.source.observations.placements);
  const domains = temporalDomains(registry, built);
  const tracks: Track[] = [];
  for (const item of built.tracks) {
    const projectedSpans = spans(item.value, input.frameRate);
    const binding = registry.bindTrack(item);
    const placement = item.trace.module === undefined ? undefined
      : built.source.observations.placements.find((candidate) =>
        candidate.id === item.trace.authoredId
        && sameModule(candidate.module, item.trace.module!)
        && candidate.surface === item.trace.surface);
    const generic = (): readonly StudioEntityDraft[] => projectedSpans.map((span) => {
      const identity = span.subjectId ?? span.id;
      const where = located.find((candidate) => candidate.id === identity);
      return {
        id: `${item.outputRef}:${span.id}`,
        ...(sameType(item.typeRef, compositionTypes.visualTrack) ? { presentId: span.id } : {}),
        authoredId: identity,
        display: { title: identity, layers: [] },
        startFrame: span.startFrame,
        endFrameExclusive: span.endFrameExclusive,
        ...(where === undefined ? {} : { elementRange: where.range }),
        stackOrder: span.stackOrder,
      };
    });
    const drafts = registry.projectTrack({
      track: item,
      ...(placement === undefined ? {} : { placement }),
      ...(item.surfacePreview === undefined ? {} : { surfacePreview: item.surfacePreview }),
      spans: projectedSpans,
      values: built.values,
      temporalBindings: built.temporalBindings.get(item.outputRef) ?? [],
      temporalDomains: domains,
      generic,
    }).map((draft) => {
      const declarations = composeParameterDeclarations({
        placement, draft, placements: built.source.observations.placements, registry,
        bindings: registry.bindingDeclarations(item, placement, draft.lane, draft.band),
        inspector: registry.inspectorDeclarations(item, placement, draft.lane, draft.band),
      });
      const bindings = sourceBindingsForDraft({
        root: input.workspaceRoot,
        files: input.sourceFiles,
        placement,
        draft,
        declarations: [
          ...declarations.bindings,
          ...temporalBindingDeclarations(draft.temporal),
        ],
        placements: built.source.observations.placements,
      });
      const inspector = inspectorFieldsForBindings(
        draft,
        bindings,
        declarations.inspector,
      );
      const editHandles = resolveTimelineEditHandles(
        bindings,
        draft.temporal,
        domains,
      );
      return {
        draft,
        inspector,
        editHandles,
      };
    });
    const clips: Clip[] = drafts
      .filter(({ draft }) => draft.lane === undefined)
      .map(({ draft, inspector, editHandles }) => sealStudioClip(item.outputRef, draft, binding, editHandles, inspector));
    const provenance: CandidateProvenance = {
      output: item.name,
      outputRef: item.outputRef,
      ...(item.candidateId === undefined ? {} : { candidateId: item.candidateId }),
      origin: item.candidateOrigin,
      status: "resolved",
      errors: [],
    };
    tracks.push({
      id: item.outputRef,
      label: item.name,
      row: 0,
      clips,
      binding,
      provenance,
    });
    for (const attachment of registry.trackAttachments(item)) {
      const attachedDrafts = drafts.filter(({ draft }) => draft.lane === attachment.attachmentId);
      if (attachedDrafts.length === 0) continue;
      tracks.push({
        id: `${item.outputRef}::studio::${attachment.attachmentId}`,
        label: attachment.label ?? attachment.attachmentId ?? item.name,
        row: 0,
        clips: attachedDrafts.map(({ draft, inspector, editHandles }) =>
          sealStudioClip(item.outputRef, draft, attachment, editHandles, inspector)),
        binding: attachment,
        provenance,
      });
    }
  }
  // Root lanes retain Film's authored organizational order. A Present's z is
  // local compositing data and cannot define the order of a Track containing
  // independently stacked items. Studio-only detail lanes stay beside the
  // root that produced them in this list.
  const rows = tracks.map((track, row) => ({ ...track, row }));

  const frameCount = timelineFrameCount(built.timeline);
  return {
    revision: input.revision,
    source: {
      path: input.path,
      text: input.text,
      files: input.sourceFiles.map((file) => ({
        path: relative(input.workspaceRoot, file.path),
        text: file.text,
        language: file.language,
        role: file.role ?? "dependency",
        imports: (file.imports ?? []).map((item) => item.source),
      })),
    },
    run: input.run,
    canvas: {
      width: input.canvas.width,
      height: input.canvas.height,
      clearColor: input.canvas.clearColor,
    },
    timeline: {
      frameRate: input.frameRate,
      frameCount,
      durationSec: frameCount * input.frameRate.denominator / input.frameRate.numerator,
    },
    tracks: rows,
    temporalDomains: domains,
    preview: input.preview,
    provenance: {
      picture: "resolved",
      note: note(built),
    },
  };
}

function note(_built: StudioProjection): string {
  return "Composition and timing are resolved from the selected Run Source.";
}
