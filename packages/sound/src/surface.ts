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
import { soundStyle } from "./style.js";
import type { SoundStyle } from "./style.js";
import { soundTypes, soundProducers, ordinaryInputs } from "./manifest.js";

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
export const decodeSoundTrackSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline"]);
  const id = textAttribute(element, "id"), context = resolveTemporalContext({ element, resolveReference });
  const records: SurfaceRecordDraft[] = [{ id: `${id}.header`, type: soundTypes.header, value: { kind: "inline", value: { id } }, range: element.range }];
  const components: SurfaceComponentDraft[] = [];
  const fragments = [] as ReturnType<typeof sealGraphFragment>[];
  const collectorInputs = [{ name: "timeline", type: timelineTypes.track }, { name: "header", type: soundTypes.header }];
  const bindings: Record<string, SurfaceResolvedReference["ref"]> = { timeline: context.timeline.ref, header: { kind: "record", id: `${id}.header` } };
  const operations: FragmentOperation[] = [{ id: "empty", producer: soundProducers.create, inputs: {}, result: { kind: "output", name: "set" } }];
  let previous = "empty", index = 0;
  for (const child of element.children) {
    if (child.kind === "text") { if (child.value.trim()) throw new Error("Sound Track accepts Use children."); continue; }
    if (child.name.split(":").at(-1) !== "Use") throw new Error("Sound Track accepts Use children.");
    assertAttributes(child, ["id", "style", ...temporalWindowAttributeNames]); assertEmptyElement(child);
    const useId = optionalTextAttribute(child, "id") ?? `${id}.use.${index + 1}`;
    index += 1;
    const hasTime = temporalWindowAttributeNames.some(name => child.attributes[name] !== undefined);
    const temporal = createTemporalWindowProjection({ id: useId, ...context, resolveReference,
      element: hasTime ? child : { ...child, attributes: { ...child.attributes, during: "program" } } });
    records.push(...temporal.records); components.push(...temporal.components); fragments.push(...temporal.fragments);
    const value = authored<SoundStyle>(reference(child, "style", soundTypes.style, resolveReference));
    const style = soundStyle(value.fragment, value.bindings);
    fragments.push(style.fragment);
    const audioId = `${useId}.audio`;
    components.push({ id: `${useId}.__style`, fragment: style.fragment.id,
      inputs: { ...Object.fromEntries(Object.entries(style.bindings).map(([key, bound]) => [key, bound.ref])),
        timeline: context.timeline.ref, window: temporal.ref }, outputs: { audio: audioId }, range: child.range });
    const suffix = `use-${operations.length}`;
    collectorInputs.push({ name: `${suffix}-window`, type: temporalTypes.window }, { name: `${suffix}-audio`, type: compositionTypes.audioTrack });
    bindings[`${suffix}-window`] = temporal.ref; bindings[`${suffix}-audio`] = { kind: "component-output", component: `${useId}.__style`, output: "audio" };
    operations.push({ id: suffix, producer: soundProducers.append, inputs: { set: operation(previous), window: input(`${suffix}-window`), audio: input(`${suffix}-audio`) }, result: { kind: "output", name: "set" } });
    previous = suffix;
  }
  operations.push({ id: "resolve", producer: soundProducers.resolve, inputs: { set: operation(previous), timeline: input("timeline"), header: input("header") }, result: { kind: "output", name: "audio" } });
  const collector = sealGraphFragment({ inputs: collectorInputs, operations, exports: [{ name: "audio", type: compositionTypes.audioTrack, root: operation("resolve") }, { name: "program", type: soundTypes.set, root: operation(previous) }] });
  fragments.push(collector);
  components.push({ id, fragment: collector.id, inputs: bindings, outputs: { audio: `${id}.audio`, program: `${id}.program` }, range: element.range });
  return { records, components, fragments, exports: [`${id}.audio`, `${id}.program`] };
};

export const ordinarySoundFragment = sealGraphFragment({
  inputs: ordinaryInputs,
  operations: [{ id: "ordinary", producer: soundProducers.ordinary,
    inputs: Object.fromEntries(ordinaryInputs.map(port => [port.name, input(port.name)])), result: { kind: "output", name: "audio" } }],
  exports: [{ name: "audio", type: compositionTypes.audioTrack, root: operation("ordinary") }],
});
export const decodeSoundStyleSurface: StructuredSurfaceHandler = ({ element }) => {
  assertAttributes(element, ["id", "gain", "end-gain"]); assertEmptyElement(element);
  const id = textAttribute(element, "id");
  const number = (name: string, fallback: number): number => {
    const raw = optionalTextAttribute(element, name);
    const value = raw === undefined ? fallback : raw.trim() === "" ? NaN : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 64) throw new Error(`Sound Style ${name} must be a gain from 0 to 64.`);
    return value;
  };
  const gain = number("gain", 1), endGain = number("end-gain", gain);
  const specId = `${id}.gain`;
  const style = soundStyle(ordinarySoundFragment, { spec: { ref: { kind: "record", id: specId }, type: soundTypes.gain } });
  return { records: [
    { id: specId, type: soundTypes.gain, value: { kind: "inline", value: { gain, endGain } }, range: element.range },
    { id, type: soundTypes.style, value: { kind: "inline", value: canonicalize(style) }, range: element.range },
  ], components: [], fragments: [] };
};
