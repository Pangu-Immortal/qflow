import { sealGraphFragment } from "@qflow/elaborator";
import type { FragmentOperation, GraphFragment } from "@qflow/elaborator";
import {
  assertAttributes, assertEmptyElement, localName, textAttribute,
  type StructuredElement, type StructuredSurfaceHandler, type SurfaceComponentDraft,
  type SurfaceRecordDraft, type SurfaceResolvedReference,
} from "@qflow/markup";
import { narrativeTypes } from "@qflow/narrative";
import { canonicalize, sameType, type TypeRef } from "@qflow/protocol";
import { temporalProducers, temporalTypes } from "@qflow/temporal";
import type { TemporalDuration } from "@qflow/temporal";
import { parseTemporalDuration } from "@qflow/temporal-markup";
import { timelineTypes } from "@qflow/timeline";

import { narrativeTemporalProducers, narrativeTemporalTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

function reference(path: unknown, subject: string, type: TypeRef,
  resolve: (path: string) => SurfaceResolvedReference | undefined): SurfaceResolvedReference {
  if (typeof path !== "object" || path === null || !("kind" in path) || path.kind !== "reference" || !("path" in path)
    || typeof path.path !== "string") throw new Error(`${subject} must be a reference.`);
  const found = resolve(path.path);
  if (found === undefined || !sameType(found.type, type)) throw new Error(`${subject} has the wrong Type.`);
  return found;
}

type ProjectionMap = {
  readonly alignment: SurfaceResolvedReference;
  readonly domain: SurfaceResolvedReference;
  readonly window: SurfaceResolvedReference;
};
type ProjectionOutput = { readonly element: StructuredElement; readonly id: string; readonly kind: "instant" | "window";
  readonly sourceKind: "selection" | "segment" | "moment"; readonly source: SurfaceResolvedReference;
  readonly boundary?: "start" | "end"; readonly offset?: TemporalDuration };

function offset(element: StructuredElement): TemporalDuration | undefined {
  const raw = element.attributes.offset;
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || !/^[+-]?\d+(?:\.\d+)?(?:f|ms|s)$/u.test(raw.trim())) {
    throw new Error(`${element.name}.offset must be an exact signed duration.`);
  }
  const value = raw.trim(), negative = value.startsWith("-");
  const parsed = parseTemporalDuration(value.replace(/^[+-]/u, ""), `${element.name}.offset`);
  if (!negative) return parsed;
  return parsed.unit === "seconds" ? { ...parsed, numerator: -parsed.numerator } : { ...parsed, value: -parsed.value };
}

function projectionOutput(element: StructuredElement,
  resolveReference: (path: string) => SurfaceResolvedReference | undefined): ProjectionOutput {
  const tag = localName(element.name);
  if (tag === "Window") {
    assertAttributes(element, ["id", "selection", "segment"], ["id"]); assertEmptyElement(element);
    const selection = element.attributes.selection, segment = element.attributes.segment;
    if (Number(selection !== undefined) + Number(segment !== undefined) !== 1) {
      throw new Error(`${element.name} requires exactly one of selection or segment.`);
    }
    return selection !== undefined
      ? { element, id: textAttribute(element, "id"), kind: "window", sourceKind: "selection",
          source: reference(selection, `${element.name}.selection`, narrativeTypes.selection, resolveReference) }
      : { element, id: textAttribute(element, "id"), kind: "window", sourceKind: "segment",
          source: reference(segment, `${element.name}.segment`, narrativeTypes.segmentRef, resolveReference) };
  }
  if (tag !== "Instant") throw new Error(`Projection accepts Map, Window and Instant children only.`);
  assertAttributes(element, ["id", "selection", "segment", "moment", "boundary", "offset"], ["id"]); assertEmptyElement(element);
  const sources = ["selection", "segment", "moment"].filter((name) => element.attributes[name] !== undefined);
  if (sources.length !== 1) throw new Error(`${element.name} requires exactly one of selection, segment or moment.`);
  const sourceKind = sources[0] as "selection" | "segment" | "moment";
  const sourceType = sourceKind === "selection" ? narrativeTypes.selection
    : sourceKind === "segment" ? narrativeTypes.segmentRef : narrativeTypes.moment;
  const boundaryRaw = element.attributes.boundary;
  if (sourceKind === "moment") {
    if (boundaryRaw !== undefined) throw new Error(`${element.name}.boundary is invalid for a Moment.`);
    const projectedOffset = offset(element);
    return { element, id: textAttribute(element, "id"), kind: "instant", sourceKind,
      source: reference(element.attributes.moment, `${element.name}.moment`, sourceType, resolveReference),
      ...(projectedOffset === undefined ? {} : { offset: projectedOffset }) };
  }
  if (boundaryRaw !== "start" && boundaryRaw !== "end") {
    throw new Error(`${element.name}.boundary must be start or end.`);
  }
  const projectedOffset = offset(element);
  return { element, id: textAttribute(element, "id"), kind: "instant", sourceKind,
    source: reference(element.attributes[sourceKind], `${element.name}.${sourceKind}`, sourceType, resolveReference),
    boundary: boundaryRaw, ...(projectedOffset === undefined ? {} : { offset: projectedOffset }) };
}

function projectionProducer(kind: ProjectionOutput["sourceKind"]) {
  return kind === "selection" ? narrativeTemporalProducers.projectSelectionInstant
    : kind === "segment" ? narrativeTemporalProducers.projectSegmentInstant
      : narrativeTemporalProducers.projectMomentInstant;
}

function outputFragment(output: ProjectionOutput): GraphFragment {
  const sourceType = output.sourceKind === "selection" ? narrativeTypes.selection
    : output.sourceKind === "segment" ? narrativeTypes.segmentRef : narrativeTypes.moment;
  const ports: Array<{ readonly name: string; readonly type: TypeRef }> = [
    { name: "timeline", type: timelineTypes.timeline },
    { name: "projection", type: narrativeTemporalTypes.narrativeProjection },
    { name: "source", type: sourceType },
    { name: "start-spec", type: narrativeTemporalTypes.narrativeInstantSpec },
  ];
  const operations: FragmentOperation[] = [{ id: "start", producer: projectionProducer(output.sourceKind), inputs: {
    timeline: input("timeline"), projection: input("projection"), [output.sourceKind]: input("source"), spec: input("start-spec"),
  }, result: { kind: "output", name: "instant" } }];
  if (output.kind === "instant") return sealGraphFragment({ inputs: ports, operations,
    exports: [{ name: "instant", type: temporalTypes.instant, root: operation("start") }] });
  ports.push({ name: "end-spec", type: narrativeTemporalTypes.narrativeInstantSpec },
    { name: "window-spec", type: temporalTypes.windowSpec });
  operations.push({ id: "end", producer: projectionProducer(output.sourceKind), inputs: {
    timeline: input("timeline"), projection: input("projection"), [output.sourceKind]: input("source"), spec: input("end-spec"),
  }, result: { kind: "output", name: "instant" } }, {
    id: "window", producer: temporalProducers.composeWindow,
    inputs: { spec: input("window-spec"), start: operation("start"), end: operation("end") },
    result: { kind: "output", name: "window" },
  });
  return sealGraphFragment({ inputs: ports, operations, exports: [
    { name: "window", type: temporalTypes.window, root: operation("window") },
    { name: "start", type: temporalTypes.instant, root: operation("start") },
    { name: "end", type: temporalTypes.instant, root: operation("end") },
  ] });
}

/** Build one Narrative projection and the explicitly requested absolute values derived from it. */
export const decodeNarrativeProjectionSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "narrative", "timeline"]);
  const id = textAttribute(element, "id");
  const narrative = reference(element.attributes.narrative, `${element.name}.narrative`, narrativeTypes.narrative, resolveReference);
  const timeline = reference(element.attributes.timeline, `${element.name}.timeline`, timelineTypes.timeline, resolveReference);
  const maps: ProjectionMap[] = [], requested: ProjectionOutput[] = [];
  const outputIds = new Set<string>();
  for (const child of element.children) {
    if (child.kind === "text") { if (child.value.trim()) throw new Error(`${element.name} accepts Map, Window and Instant children only.`); continue; }
    if (localName(child.name) === "Map") {
      assertAttributes(child, ["alignment", "domain", "window"]); assertEmptyElement(child);
      maps.push({
        alignment: reference(child.attributes.alignment, `${child.name}.alignment`, narrativeTemporalTypes.narrativeAlignment, resolveReference),
        domain: reference(child.attributes.domain, `${child.name}.domain`, temporalTypes.localDomain, resolveReference),
        window: reference(child.attributes.window, `${child.name}.window`, temporalTypes.window, resolveReference),
      });
      continue;
    }
    const output = projectionOutput(child, resolveReference);
    if (outputIds.has(output.id)) throw new Error(`${element.name} repeats output ${output.id}.`);
    outputIds.add(output.id); requested.push(output);
  }
  if (maps.length === 0) throw new Error(`${element.name} requires at least one Map.`);

  const ports: Array<{ readonly name: string; readonly type: TypeRef }> = [
    { name: "header", type: narrativeTemporalTypes.narrativeProjectionHeader },
    { name: "narrative", type: narrativeTypes.narrative }, { name: "timeline", type: timelineTypes.timeline },
  ];
  const bindings: Record<string, SurfaceResolvedReference["ref"] | { kind: "record"; id: string }> = {
    header: { kind: "record", id: `${id}.__header` }, narrative: narrative.ref, timeline: timeline.ref,
  };
  const operations: FragmentOperation[] = [], entryRoots: string[] = [];
  for (const [index, map] of maps.entries()) {
    const alignmentName = `alignment-${index + 1}`;
    const domainName = `domain-${index + 1}`;
    const windowName = `window-${index + 1}`;
    ports.push({ name: alignmentName, type: narrativeTemporalTypes.narrativeAlignment },
      { name: domainName, type: temporalTypes.localDomain },
      { name: windowName, type: temporalTypes.window });
    bindings[alignmentName] = map.alignment.ref;
    bindings[domainName] = map.domain.ref;
    bindings[windowName] = map.window.ref;
    const operationId = `entry-${index + 1}`;
    operations.push({ id: operationId, producer: narrativeTemporalProducers.projectAlignment,
      inputs: { alignment: input(alignmentName), domain: input(domainName), window: input(windowName), timeline: input("timeline") },
      result: { kind: "output", name: "parts" } });
    entryRoots.push(operationId);
  }
  let level = entryRoots, combineIndex = 0;
  while (level.length > 1) {
    const next: string[] = [];
    for (let cursor = 0; cursor < level.length; cursor += 2) {
      const left = level[cursor]!, right = level[cursor + 1];
      if (right === undefined) { next.push(left); continue; }
      const operationId = `combine-${++combineIndex}`;
      operations.push({ id: operationId, producer: narrativeTemporalProducers.combineProjectionParts,
        inputs: { left: operation(left), right: operation(right) }, result: { kind: "output", name: "parts" } });
      next.push(operationId);
    }
    level = next;
  }
  operations.push({ id: "finalize", producer: narrativeTemporalProducers.finalizeProjection,
    inputs: { header: input("header"), narrative: input("narrative"), timeline: input("timeline"), parts: operation(level[0]!) },
    result: { kind: "output", name: "projection" } });
  const projectionFragment = sealGraphFragment({ inputs: ports, operations,
    exports: [{ name: "projection", type: narrativeTemporalTypes.narrativeProjection, root: operation("finalize") }] });
  const records: SurfaceRecordDraft[] = [{ id: `${id}.__header`, type: narrativeTemporalTypes.narrativeProjectionHeader,
    value: { kind: "inline", value: canonicalize({ id }) }, range: element.range }];
  const components: SurfaceComponentDraft[] = [{ id, fragment: projectionFragment.id, inputs: bindings,
    outputs: { projection: `${id}.projection` }, range: element.range }];
  const fragments: GraphFragment[] = [projectionFragment];
  const exports = [`${id}.projection`];
  for (const output of requested) {
    const subjectId = `${id}.${output.id}`, fragment = outputFragment(output);
    const startSpecId = `${subjectId}.__start`;
    const startBoundary = output.kind === "window" ? "start"
      : output.sourceKind === "moment" ? "cue" : output.boundary!;
    records.push({ id: startSpecId, type: narrativeTemporalTypes.narrativeInstantSpec,
      value: { kind: "inline", value: { id: `${subjectId}.start`, subjectId, boundary: startBoundary,
        ...(output.offset === undefined ? {} : { offset: output.offset }) } }, range: output.element.range });
    const childBindings: Record<string, SurfaceResolvedReference["ref"] | { kind: "record"; id: string }> = {
      timeline: timeline.ref, projection: { kind: "component-output", component: id, output: "projection" },
      source: output.source.ref, "start-spec": { kind: "record", id: startSpecId },
    };
    const outputNames = output.kind === "instant"
      ? { instant: subjectId }
      : { window: subjectId, start: `${subjectId}.start`, end: `${subjectId}.end` };
    if (output.kind === "window") {
      const endSpecId = `${subjectId}.__end`, windowSpecId = `${subjectId}.__window`;
      records.push({ id: endSpecId, type: narrativeTemporalTypes.narrativeInstantSpec,
        value: { kind: "inline", value: { id: `${subjectId}.end`, subjectId, boundary: "end" } }, range: output.element.range },
      { id: windowSpecId, type: temporalTypes.windowSpec,
        value: { kind: "inline", value: { id: subjectId, subjectId } }, range: output.element.range });
      childBindings["end-spec"] = { kind: "record", id: endSpecId };
      childBindings["window-spec"] = { kind: "record", id: windowSpecId };
    }
    components.push({ id: `${subjectId}.__projection`, fragment: fragment.id, inputs: childBindings,
      outputs: outputNames, range: output.element.range });
    fragments.push(fragment); exports.push(...Object.values(outputNames));
  }
  return { records, components, fragments, exports };
};

export const narrativeProjectionMarkupSurface = {
  name: "narrative-projection", tag: "Projection", mode: "structured",
  outputs: [narrativeTemporalTypes.narrativeProjectionHeader, narrativeTemporalTypes.narrativeInstantSpec,
    narrativeTemporalTypes.narrativeProjection, temporalTypes.windowSpec, temporalTypes.instant, temporalTypes.window],
  vocabulary: {
    summary: "Projects explicit NarrativeAlignment values onto one Timeline and publishes requested absolute values.",
    attributes: [
      { name: "id", kind: "identifier", required: true, summary: "Names this projection." },
      { name: "narrative", kind: "reference", required: true, accepts: [narrativeTypes.narrative], summary: "Selects the Narrative identity." },
      { name: "timeline", kind: "reference", required: true, accepts: [timelineTypes.timeline], summary: "Selects the target Timeline." },
    ],
    children: [
      { tag: "Map", cardinality: "many", summary: "Projects one local NarrativeAlignment through an exact domain-to-Window relation.", attributes: [
        { name: "alignment", kind: "reference", required: true, accepts: [narrativeTemporalTypes.narrativeAlignment], summary: "Local Narrative timing facts." },
        { name: "domain", kind: "reference", required: true, accepts: [temporalTypes.localDomain], summary: "The Alignment's complete local coordinate domain." },
        { name: "window", kind: "reference", required: true, accepts: [temporalTypes.window], summary: "Equal-length absolute Window receiving that domain." },
      ] },
      { tag: "Window", cardinality: "many", summary: "Publishes one selected Segment or Selection as an absolute Window.", attributes: [
        { name: "id", kind: "identifier", required: true, summary: "Scoped absolute output name." },
        { name: "selection", kind: "reference", required: false, accepts: [narrativeTypes.selection], summary: "Selection to project." },
        { name: "segment", kind: "reference", required: false, accepts: [narrativeTypes.segmentRef], summary: "Segment to project." },
      ] },
      { tag: "Instant", cardinality: "many", summary: "Publishes one Narrative boundary as an absolute Instant.", attributes: [
        { name: "id", kind: "identifier", required: true, summary: "Scoped absolute output name." },
        { name: "moment", kind: "reference", required: false, accepts: [narrativeTypes.moment], summary: "Moment cue to project." },
        { name: "selection", kind: "reference", required: false, accepts: [narrativeTypes.selection], summary: "Selection boundary source." },
        { name: "segment", kind: "reference", required: false, accepts: [narrativeTypes.segmentRef], summary: "Segment boundary source." },
        { name: "boundary", kind: "literal", required: false, values: ["start", "end"], summary: "Boundary for Selection or Segment." },
        { name: "offset", kind: "literal", required: false, summary: "Exact signed offset applied after projection." },
      ] },
    ],
    ports: [
      { name: "projection", type: narrativeTemporalTypes.narrativeProjection, summary: "The explicit Narrative-to-absolute relation." },
      { name: "<name>", type: temporalTypes.instant, summary: "Requested scoped Instant." },
      { name: "<name>", type: temporalTypes.window, summary: "Requested scoped Window with .start and .end Instants." },
    ],
    example: `<semantic:Projection id="story-time" narrative={story} timeline={film.timeline}>
  <semantic:Map alignment={opening.alignment} domain={opening.domain} window={program.opening}/>
  <semantic:Window id="proof" selection={story.selection.proof}/>
  <semantic:Instant id="claim" moment={story.moment.claim}/>
</semantic:Projection>`,
  },
} as const;
