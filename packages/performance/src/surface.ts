import { assertAttributes, assertEmptyElement, textAttribute, optionalTextAttribute } from "@qflow/markup";
import type { StructuredSurfaceHandler, SurfaceResolvedReference, SurfaceRecordDraft, SurfaceComponentDraft, StructuredElement } from "@qflow/markup";
import { canonicalize, sameType } from "@qflow/protocol";
import type { TypeRef } from "@qflow/protocol";
import { sealGraphFragment } from "@qflow/elaborator";
import type { FragmentOperation } from "@qflow/elaborator";
import { createTemporalWindowProjection, resolveTemporalContext, temporalWindowAttributeNames } from "@qflow/temporal-markup";
import { temporalTypes } from "@qflow/temporal";
import { compositionTypes } from "@qflow/composition";
import { timelineTypes } from "@qflow/timeline";
import { spatialTypes } from "@qflow/spatial";
import { svsRecipeType } from "@qflow/svs";
import type { SvsRecipe } from "@qflow/svs";
import { decodeMediaFit, decodeMediaSampleSpec, decodeMediaItemSpec, mediaTrackTypes } from "@qflow/media-track";
import { performanceStyle } from "./style.js";
import type { PerformanceStyle } from "./style.js";
import { performanceTypes, performanceProducers, ordinaryInputs } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });
function reference(element: StructuredElement, name: string, type: TypeRef, resolve: (path: string) => SurfaceResolvedReference | undefined): SurfaceResolvedReference {
  const raw = element.attributes[name];
  if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${element.name}.${name} must be a reference.`);
  const found = resolve(raw.path);
  if (found === undefined || !sameType(found.type, type)) throw new Error(`${element.name}.${name} has the wrong Type.`);
  return found;
}
function authored<T>(value: SurfaceResolvedReference): T {
  if (value.record?.value.kind !== "inline") throw new Error("A presentation Style or Recipe must be an authored inline value.");
  return value.record.value.value as unknown as T;
}
export const ordinaryPerformanceFragment = sealGraphFragment({
  inputs: ordinaryInputs,
  operations: [{ id: "ordinary", producer: performanceProducers.ordinary,
    inputs: Object.fromEntries(ordinaryInputs.map(port => [port.name, input(port.name)])), result: { kind: "output", name: "visual" } }],
  exports: [{ name: "visual", type: compositionTypes.visualTrack, root: operation("ordinary") }],
});
export const decodePerformanceStyleSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "frame", "appearance"]); assertEmptyElement(element);
  const id = textAttribute(element, "id");
  const frame = reference(element, "frame", spatialTypes.frame, resolveReference);
  const recipe = authored<SvsRecipe>(reference(element, "appearance", svsRecipeType, resolveReference));
  if (["playback", "trim-start", "trim-end"].some(key => recipe.properties[key] !== undefined)) throw new Error("Performance uses Timeline source positions; select its presentation interval on Use.");
  const records: SurfaceRecordDraft[] = [];
  const bind = (name: string, type: TypeRef, value: unknown) => {
    const recordId = `${id}.${name}`;
    records.push({ id: recordId, type, value: { kind: "inline", value: canonicalize(value) }, range: element.range });
    return { ref: { kind: "record" as const, id: recordId }, type };
  };
  const style = performanceStyle(ordinaryPerformanceFragment, {
    frame,
    fit: bind("fit", spatialTypes.fit, decodeMediaFit(recipe)),
    sample: bind("sample", mediaTrackTypes.sampleLayerSpec, decodeMediaSampleSpec(recipe, "content", "timed", undefined, true)),
    spec: bind("spec", mediaTrackTypes.itemSpec, decodeMediaItemSpec(recipe, { id, motion: { sustain: [] } })),
  });
  records.push({ id, type: performanceTypes.style, value: { kind: "inline", value: canonicalize(style) }, range: element.range });
  return { records, components: [], fragments: [] };
};

export const decodePerformanceTrackSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "canvas"]);
  const id = textAttribute(element, "id"), context = resolveTemporalContext({ element, resolveReference });
  const canvas = reference(element, "canvas", spatialTypes.canvas, resolveReference);
  const records: SurfaceRecordDraft[] = [{ id: `${id}.header`, type: performanceTypes.header, value: { kind: "inline", value: { id } }, range: element.range }];
  const components: SurfaceComponentDraft[] = [];
  const fragments = [] as ReturnType<typeof sealGraphFragment>[];
  const collectorInputs = [{ name: "timeline", type: timelineTypes.track }, { name: "header", type: performanceTypes.header }];
  const bindings: Record<string, SurfaceResolvedReference["ref"]> = { timeline: context.timeline.ref, header: { kind: "record", id: `${id}.header` } };
  const operations: FragmentOperation[] = [{ id: "empty", producer: performanceProducers.create, inputs: {}, result: { kind: "output", name: "set" } }];
  let previous = "empty", index = 0;
  for (const child of element.children) {
    if (child.kind === "text") { if (child.value.trim()) throw new Error("Performance Track accepts Use children."); continue; }
    if (child.name.split(":").at(-1) !== "Use") throw new Error("Performance Track accepts Use children.");
    assertAttributes(child, ["id", "style", ...temporalWindowAttributeNames]); assertEmptyElement(child);
    const useId = optionalTextAttribute(child, "id") ?? `${id}.use.${index + 1}`;
    index += 1;
    const hasTime = temporalWindowAttributeNames.some(name => child.attributes[name] !== undefined);
    const temporal = createTemporalWindowProjection({ id: useId, ...context, resolveReference,
      element: hasTime ? child : { ...child, attributes: { ...child.attributes, during: "program" } } });
    records.push(...temporal.records); components.push(...temporal.components); fragments.push(...temporal.fragments);
    const value = authored<PerformanceStyle>(reference(child, "style", performanceTypes.style, resolveReference));
    const style = performanceStyle(value.fragment, value.bindings);
    fragments.push(style.fragment);
    const visualId = `${useId}.visual`;
    components.push({ id: `${useId}.__style`, fragment: style.fragment.id,
      inputs: { ...Object.fromEntries(Object.entries(style.bindings).map(([key, bound]) => [key, bound.ref])),
        timeline: context.timeline.ref, canvas: canvas.ref, window: temporal.ref }, outputs: { visual: visualId }, range: child.range });
    const suffix = `use-${operations.length}`;
    collectorInputs.push({ name: `${suffix}-window`, type: temporalTypes.window }, { name: `${suffix}-visual`, type: compositionTypes.visualTrack });
    bindings[`${suffix}-window`] = temporal.ref; bindings[`${suffix}-visual`] = { kind: "component-output", component: `${useId}.__style`, output: "visual" };
    operations.push({ id: suffix, producer: performanceProducers.append, inputs: { set: operation(previous), window: input(`${suffix}-window`), visual: input(`${suffix}-visual`) }, result: { kind: "output", name: "set" } });
    previous = suffix;
  }
  operations.push({ id: "resolve", producer: performanceProducers.resolve, inputs: { set: operation(previous), timeline: input("timeline"), header: input("header") }, result: { kind: "output", name: "visual" } });
  const collector = sealGraphFragment({ inputs: collectorInputs, operations, exports: [{ name: "visual", type: compositionTypes.visualTrack, root: operation("resolve") }, { name: "program", type: performanceTypes.set, root: operation(previous) }] });
  fragments.push(collector);
  components.push({ id, fragment: collector.id, inputs: bindings, outputs: { visual: `${id}.visual`, program: `${id}.program` }, range: element.range });
  return { records, components, fragments, exports: [`${id}.visual`, `${id}.program`] };
};
