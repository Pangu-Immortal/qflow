import { composeParameterDeclarations } from "./parameters.js";
/**
 * Turn a built programme into what the panels read.
 *
 * The Timeline owns the work range. Companions project selectable entities onto
 * that range without extending it or requiring component-specific editor code.
 */
import { relative } from "node:path";

import type { MarkupSurfaceRegistryLike } from "@qflow/markup";
import { compositionTypes } from "@qflow/composition";
import { timelineFrameCount } from "@qflow/timeline";
import { sameModule, sameType } from "@qflow/protocol";

import type {
  CandidateProvenance,
  Clip,
  StudioSnapshot,
  Range,
  ScriptMap,
  SemanticTimeline,
  Track,
} from "./shared.js";
import type { Placement } from "./observe.js";
import type { Preview } from "./programme.js";
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

function scriptMap(
  maps: Preview["source"]["observations"]["sourceMaps"],
  built: Preview,
  narrativeId: string,
): ScriptMap | undefined {
  const candidates = maps.filter((map, index) => map.narrativeId === narrativeId
    && maps.findIndex((other) => other.narrativeId === map.narrativeId
      && other.sourcePath === map.sourcePath
      && other.range.start === map.range.start
      && other.range.end === map.range.end) === index);
  if (candidates.length > 1) {
    throw new Error(`Studio Narrative id ${narrativeId} is declared by more than one Script in the Source closure.`);
  }
  const found = candidates[0];
  if (found === undefined) return undefined;
  const selections = found.selections;
  const segments = found.segments;
  const moments = found.moments;
  return {
    companion: found.companion,
    narrativeId: found.narrativeId,
    sourcePath: found.sourcePath,
    range: found.range,
    content: found.content,
    // A Segment is the outermost range a Script declares; a Selection written
    // inside one is a level down, and one inside that another.
    segments: segments.map((segment) => ({ ...segment, depth: 0 })),
    selections: selections.map((selection) => ({
      ...selection,
      depth: depthOf(selection, selections),
    })),
    moments,
    // A Script says where a word is written; the timings say when it is said.
    tokens: found.tokens.flatMap((token) => {
      const placed = built.tokens.find((item) => item.id === token.id);
      const startFrame = placed === undefined ? undefined : built.anchors.get(placed.startAnchorId);
      const endFrame = placed === undefined ? undefined : built.anchors.get(placed.endAnchorId);
      if (startFrame === undefined || endFrame === undefined) return [];
      return [{ id: token.id, range: token.range, startFrame, endFrame }];
    }),
  };
}

/**
 * Project the compiled Narrative into the frame domain that the preview is
 * already using. No frontend timing is invented here: if an anchor is absent
 * from the built Timeline, the corresponding item is simply not drawable yet.
 */
function semanticTimeline(
  registry: StudioCompanionRegistry,
  built: Preview,
  script: ScriptMap | undefined,
): SemanticTimeline | undefined {
  if (built.narrativeId === undefined) return undefined;
  if (script === undefined) throw new Error("Timeline's Script has no Studio source mapping.");
  const projected = registry.projectScript({ source: script, anchors: built.anchors,
    values: built.source.compiled.program.records.flatMap(record => record.value.kind === "inline"
      ? [{ id: record.id, type: record.type, value: record.value.value }] : []),
  });
  const provenance: CandidateProvenance = {
    output: built.timingOutput?.name ?? "Timeline",
    ...(built.timingOutput?.ref === undefined ? {} : { outputRef: built.timingOutput.ref }),
    ...(built.timingCandidateId === undefined ? {} : { candidateId: built.timingCandidateId }),
    origin: built.timingCandidateOrigin,
    status: "resolved",
    errors: [],
  };
  return {
    timelineId: built.timeline.id,
    narrativeId: built.narrativeId,
    // The generic ruler presentation is independent of the authored Timeline id.
    presentation: registry.semanticTimelinePresentation(),
    // Preserve the Companion's ordered anchors, including coincident boundaries.
    ...projected,
    provenance,
  };
}

/** The element an output belongs to: `take-opening.video` is `take-opening`. */
function depthOf(
  selection: Omit<ScriptMap["selections"][number], "depth">,
  all: readonly Omit<ScriptMap["selections"][number], "depth">[],
): number {
  let depth = 1;
  for (const other of all) {
    if (other.id === selection.id) continue;
    if (other.open.start < selection.open.start && other.close.end > selection.close.end) depth += 1;
  }
  return depth;
}

export function snapshot(registry: StudioCompanionRegistry, built: Preview, input: {
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
  const script = built.narrativeId === undefined ? undefined : scriptMap(built.source.observations.sourceMaps, built, built.narrativeId);
  const semantic = semanticTimeline(registry, built, script);
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
      semantic,
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
        semantic,
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
    ...(script === undefined ? {} : { script }),
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
    ...(semantic === undefined ? {} : { semantic }),
    preview: input.preview,
    provenance: {
      picture: "resolved",
      note: note(built),
    },
  };
}

function note(_built: Preview): string {
  return "Composition and timing are resolved from the selected Run Source.";
}
