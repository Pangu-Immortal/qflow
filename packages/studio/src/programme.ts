import type { ArtifactAttachment } from "@qflow/workspace";
import type { BlobRef, ResourceId, StoredValue } from "@qflow/protocol";
import { sameType } from "@qflow/protocol";
import type { Composition } from "@qflow/composition";
import { compositionTypes } from "@qflow/composition";
import { timelineTypes, assertTimelineIdentity } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";
import { narrativeTemporalTypes } from "@qflow/narrative-temporal";
import type { NarrativeProjection } from "@qflow/narrative-temporal";
import type { StudioResolvedTrack, StudioTemporalBinding } from "@qflow/studio-adapter";
import type { RuntimeHostTransientExecution } from "@qflow/runtime-host-node";

import type { CompiledSource, ServedFile } from "./compile.js";
import type { StudioDomain } from "./domain.js";
import { executeStudioProjection, MemoryResourceStore } from "./execute.js";
import type { RunPlan } from "./run.js";
import type { StudioViewRequirement } from "./studio-preflight.js";
import { studioSurfacePreview } from "./surface-preview.js";
import { executedTemporalBindings } from "./temporal-graph.js";

function playable(type: import("@qflow/protocol").TypeRef): boolean {
  return sameType(type, compositionTypes.visualTrack) || sameType(type, compositionTypes.audioTrack);
}

export type BuiltTrack = StudioResolvedTrack;

export type Preview = {
  readonly source: CompiledSource;
  readonly tracks: readonly BuiltTrack[];
  /** Resolved Companion realizations keyed by exact graph output ref. */
  readonly values: ReadonlyMap<string, unknown>;
  readonly temporalBindings: ReadonlyMap<string, readonly StudioTemporalBinding[]>;
  readonly composition: Composition;
  readonly narrativeId?: string;
  readonly timingOutput?: { readonly name: string; readonly ref: string };
  readonly timingCandidateId?: string;
  readonly timingCandidateOrigin: "run" | "source" | "none";
  readonly served: ReadonlyMap<string, ServedFile>;
  readonly canvas: { readonly width: number; readonly height: number; readonly clearColor: string };
  readonly frameRate: { readonly numerator: number; readonly denominator: number };
  readonly timeline: Timeline;
  readonly anchors: ReadonlyMap<string, number>;
  readonly tokens: readonly {
    readonly id: string;
    readonly startAnchorId: string;
    readonly endAnchorId: string;
  }[];
};

async function bytesOf(attachment: ArtifactAttachment): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of await attachment.open()) {
    const copy = Uint8Array.from(chunk);
    chunks.push(copy);
    size += copy.byteLength;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

type ExecutionState = Awaited<ReturnType<typeof executeStudioProjection>>["state"];

function selectedValue(
  state: ExecutionState,
  output: string,
): StoredValue | undefined {
  const selection = state.plan.outputBindings.find((item) => item.output === output);
  if (selection === undefined) return state.program.records.find((item) => item.id === output)?.value;
  const executed = state.records.find((item) => item.id === selection.record)?.value;
  if (executed !== undefined) return executed;
  // Inline Source and Run candidates both belong to this freshly recompiled
  // revision. There is no stale-plan distinction to reconstruct here.
  return state.program.records.find((item) => item.id === selection.record)?.value;
}

function compositionArtifacts(composition: Composition): readonly BlobRef[] {
  const found = new Map<ResourceId, BlobRef>();
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    if ((value as { readonly kind?: unknown }).kind === "blob") {
      const artifact = value as BlobRef;
      found.set(artifact.resource, artifact);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const item of Object.values(value)) visit(item);
  };
  visit(composition);
  return [...found.values()];
}

/** Build only the Studio-approved deterministic projection of one explicit Run. */
export async function preview(input: {
  readonly source: CompiledSource;
  readonly run: RunPlan;
  readonly domain: StudioDomain;
  readonly outputRefs: readonly string[];
  readonly compositionRef: string;
  readonly timeRef: string;
  readonly projections: readonly StudioViewRequirement[];
  /** Runtime-owned execution for capabilities explicitly safe outside a Build. */
  readonly transientExecution?: RuntimeHostTransientExecution;
}): Promise<Preview> {
  const exportsByRef = new Map(input.source.exports.map((item) => [item.ref, item] as const));
  const targets = input.outputRefs.flatMap((ref) => {
    const found = exportsByRef.get(ref);
    return found === undefined ? [] : [found];
  });
  const store = new MemoryResourceStore();
  const served = new Map(input.source.served);
  for (const attachment of input.run.attachments) {
    const bytes = await bytesOf(attachment);
    await store.write(attachment.artifact, bytes);
    served.set(attachment.artifact.resource, {
      mediaType: attachment.artifact.mediaType,
      bytes,
    });
  }
  for (const [resource, file] of input.source.served) {
    await store.write({ kind: "blob", resource: resource as ResourceId, size: file.bytes.byteLength, mediaType: file.mediaType }, file.bytes);
  }
  const resources = {
    async get(resource: ResourceId) {
      return await store.get(resource);
    },
    async put(bytes: Uint8Array, mediaType: string) {
      const ref = await store.put(bytes, mediaType);
      served.set(ref.resource, { mediaType, bytes });
      return ref;
    },
    async write(resource: BlobRef, bytes: Uint8Array) {
      await store.write(resource, bytes);
      served.set(resource.resource, { mediaType: resource.mediaType, bytes });
    },
    async has(resource: ResourceId) {
      return await store.has(resource);
    },
  };
  const planned = input.run.plan(input.run.run, targets.map((target) => target.ref));
  const executed = await executeStudioProjection(
    input.domain,
    planned.state,
    resources,
    input.transientExecution,
  );
  if (executed.unserved.length > 0) {
    throw new Error(
      `Studio projection is unresolved: ${executed.unserved.map((item) => item.capability).join(", ")}`,
    );
  }
  if (executed.errors.length > 0) throw new Error(executed.errors.join("\n"));

  const satisfactions = new Map(
    input.run.run.graph.satisfactions.map((item) => [item.output, item.candidate]),
  );
  const timingOutput = input.source.exports.find((target) => target.ref === input.timeRef);
  const timingRecord = executed.state.program.records.find((record) => record.id === input.timeRef);
  const timingType = timingOutput?.typeRef ?? timingRecord?.type;
  const timingValue = selectedValue(executed.state, input.timeRef);
  if (timingValue?.kind !== "inline" || timingType === undefined) throw new Error("Studio requires a resolved film time source.");
  if (!sameType(timingType, timelineTypes.track)) throw new Error("Studio requires the declared Timeline.");
  const timeline = timingValue.value as unknown as Timeline;
  assertTimelineIdentity(timeline);
  const rate = timeline.frameRate;
  const compositionValue = selectedValue(executed.state, input.compositionRef);
  if (compositionValue?.kind !== "inline") {
    throw new Error("Studio Film composition did not produce an inline Composition.");
  }
  const composition = compositionValue.value as unknown as Composition;
  for (const artifact of compositionArtifacts(composition)) {
    if (!served.has(artifact.resource)) {
      throw new Error(`Studio composition Resource ${artifact.resource} has no Run attachment.`);
    }
  }
  const projectionByRef = new Map(input.projections.map((projection) => [projection.ref, projection]));
  const tracks: BuiltTrack[] = targets.flatMap((target) => {
    if (!playable(target.typeRef)) return [];
    const stored = selectedValue(executed.state, target.ref);
    const candidateId = satisfactions.get(target.ref);
    if (stored?.kind !== "inline") {
      throw new Error(`Studio projection ${target.name} did not produce an inline Track.`);
    }
    const projection = projectionByRef.get(target.ref);
    if (projection === undefined) {
      throw new Error(`Studio projection ${target.name} has no Studio trace.`);
    }
    const surfacePreview = projection.trace.module === undefined || projection.trace.surface === undefined
      ? undefined
      : studioSurfacePreview(input.domain, projection.trace.module, projection.trace.surface);
    return [{
      name: target.name,
      type: target.type,
      typeRef: target.typeRef,
      outputRef: target.ref,
      ...(candidateId === undefined ? {} : { candidateId }),
      candidateOrigin: candidateId === undefined ? "source" as const : "run" as const,
      role: projection.role,
      trace: projection.trace,
      ...(surfacePreview === undefined ? {} : { surfacePreview }),
      value: stored.value,
    }];
  });
  const temporalBindings = new Map(tracks.map((track) => [
    track.outputRef,
    executedTemporalBindings(executed.state, track.outputRef),
  ] as const));
  const values = new Map<string, unknown>();
  for (const target of targets) {
    const stored = selectedValue(executed.state, target.ref);
    if (stored?.kind === "inline") values.set(target.ref, stored.value);
  }
  // Author records from this compilation already carry exact qualified references.
  // Expose referenced inline values to Companions without guessing their owner by suffix.
  for (const record of input.source.compiled.program.records) {
    if (record.value.kind !== "inline") continue;
    if (input.projections.some((projection) => projection.trace.references
      .some((reference) => reference.ref === record.id))) {
      values.set(record.id, record.value.value);
    }
  }
  const narrativeProjections = input.projections.flatMap((view) => view.trace.references
    .filter((reference) => sameType(reference.typeRef, narrativeTemporalTypes.narrativeProjection))
    .flatMap((reference) => {
      const stored = selectedValue(executed.state, reference.ref);
      return stored?.kind === "inline" ? [stored.value as unknown as NarrativeProjection] : [];
    }));
  const anchors = new Map<string, number>();
  const tokens: Preview["tokens"][number][] = [];
  const narrativeIds = new Set<string>();
  for (const projection of narrativeProjections) {
    if (projection.timelineId !== timeline.id) continue;
    narrativeIds.add(projection.narrativeId);
    for (const boundary of projection.boundaries) anchors.set(boundary.id, boundary.frame);
    tokens.push(...projection.tokens.map((token) => ({
      id: token.tokenId,
      startAnchorId: token.startBoundaryId,
      endAnchorId: token.endBoundaryId,
    })));
  }
  const timingCandidateId = satisfactions.get(input.timeRef);
  return {
    source: input.source,
    tracks,
    values,
    temporalBindings,
    composition,
    ...(narrativeIds.size === 1 ? { narrativeId: [...narrativeIds][0] } : {}),
    timingOutput: { name: timingOutput?.name ?? timeline.id, ref: input.timeRef },
    ...(timingCandidateId === undefined ? {} : { timingCandidateId }),
    timingCandidateOrigin: timingCandidateId === undefined ? "source" : "run",
    served,
    canvas: composition.canvas,
    frameRate: rate,
    timeline,
    anchors,
    tokens,
  };
}
