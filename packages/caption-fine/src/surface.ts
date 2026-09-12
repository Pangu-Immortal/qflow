import { captionTypes, captionProducers } from "@qflow/caption";
import { assertFontArtifactRef, assertFontStackRef, mediaTypes } from "@qflow/media";
import type { FontArtifactRef, FontStackRef } from "@qflow/media";
import { narrativeTypes } from "@qflow/narrative";
import { timelineTypes } from "@qflow/timeline";
import { spatialTypes } from "@qflow/spatial";
import { svsRecipeType } from "@qflow/svs";
import type { SvsRecipe } from "@qflow/svs";
import type {
  StructuredElement,
  StructuredSurfaceHandler,
  SurfaceResolvedReference,
  MarkupAttributeValue,
} from "@qflow/markup";

import { sealGraphFragment } from "@qflow/elaborator";
import type { FragmentOperation } from "@qflow/elaborator";
import type { SurfaceRecordDraft, SurfaceComponentDraft } from "@qflow/markup";
import { assertEmptyElement, optionalTextAttribute } from "@qflow/markup";
import { createTemporalWindowProjection, resolveTemporalContext, temporalWindowAttributeNames } from "@qflow/temporal-markup";
import { temporalTypes } from "@qflow/temporal";
import { compositionTypes } from "@qflow/composition";
import { captionFineProducers, captionFineTypes } from "./manifest.js";
const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });
import { fineCaptionStyle } from "./style.js";

function sameType(left: SurfaceResolvedReference["type"], right: SurfaceResolvedReference["type"]): boolean {
  return left.module.name === right.module.name && left.module.version === right.module.version && left.name === right.name;
}

function attributes(element: StructuredElement, required: readonly string[], optional: readonly string[] = []): void {
  const actual = Object.keys(element.attributes);
  const allowed = new Set([...required, ...optional]);
  if (required.some((name) => element.attributes[name] === undefined) || actual.some((name) => !allowed.has(name))) {
    const suffix = optional.length === 0 ? "" : `, with optional ${optional.join(", ")}`;
    throw new Error(`${element.name} requires ${required.join(", ")}${suffix}`);
  }
}

function stringAttribute(element: StructuredElement, name: string): string {
  const value = element.attributes[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${element.name}.${name} must be a non-empty string`);
  return value.trim();
}

function reference(
  element: StructuredElement,
  name: string,
  expected: SurfaceResolvedReference["type"],
  resolveReference: (path: string) => SurfaceResolvedReference | undefined,
): SurfaceResolvedReference {
  const raw: MarkupAttributeValue | undefined = element.attributes[name];
  if (typeof raw !== "object" || raw.kind !== "reference") {
    throw new Error(`${element.name}.${name} must be a whole-value reference`);
  }
  const value = resolveReference(raw.path);
  if (value === undefined) throw new Error(`${element.name}.${name} cannot resolve ${raw.path}`);
  if (!sameType(value.type, expected)) throw new Error(`${element.name}.${name} has the wrong type`);
  return value;
}

function inline<T>(referenceValue: SurfaceResolvedReference, subject: string): T {
  if (referenceValue.record?.value.kind !== "inline") throw new Error(`${subject} must reference an authored inline Record`);
  return referenceValue.record.value.value as unknown as T;
}

function localName(name: string): string {
  const colon = name.lastIndexOf(":");
  return colon < 0 ? name : name.slice(colon + 1);
}

function exactFonts(
  element: StructuredElement,
  resolveReference: (path: string) => SurfaceResolvedReference | undefined,
): FontArtifactRef[] {
  const result: FontArtifactRef[] = [];
  const primary = element.attributes.font;
  if (primary === undefined) throw new Error(`${element.name} requires font`);
  if (typeof primary !== "object" || primary.kind !== "reference") {
    throw new Error(`${element.name}.font must be a whole-value reference`);
  }
  const resolved = resolveReference(primary.path);
  if (resolved === undefined) throw new Error(`${element.name}.font cannot resolve ${primary.path}`);
  if (sameType(resolved.type, mediaTypes.fontArtifact)) {
    result.push(inline<FontArtifactRef>(resolved, `${element.name}.font`));
  } else if (sameType(resolved.type, mediaTypes.fontStack)) {
    const stack = inline<FontStackRef>(resolved, `${element.name}.font`);
    assertFontStackRef(stack, `${element.name}.font`);
    result.push(...stack.faces);
  } else {
    throw new Error(`${element.name}.font has the wrong type`);
  }
  for (const child of element.children) {
    if (child.kind === "text") {
      if (child.value.trim()) throw new Error(`${element.name} accepts only Fallback children`);
      continue;
    }
    if (localName(child.name) !== "Fallback") throw new Error(`${element.name} accepts only Fallback children`);
    attributes(child, ["font"]);
    if (child.children.some((nested) => nested.kind === "element" || nested.value.trim())) {
      throw new Error(`${child.name} does not accept children`);
    }
    result.push(inline<FontArtifactRef>(
      reference(child, "font", mediaTypes.fontArtifact, resolveReference),
      `${child.name}.font`,
    ));
  }
  for (const [index, font] of result.entries()) assertFontArtifactRef(font, `${element.name}.font.${index + 1}`);
  return result;
}

export const decodeFineCaptionStyleSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  attributes(element, ["id", "recipe", "font"]);
  const id = stringAttribute(element, "id");
  const recipe = inline<SvsRecipe>(reference(element, "recipe", svsRecipeType, resolveReference), `${element.name}.recipe`);
  const style = fineCaptionStyle(id, recipe, exactFonts(element, resolveReference));
  return {
    records: [{ id, type: captionTypes.style, value: { kind: "inline", value: style }, range: element.range }],
    components: [],
    fragments: [],
  };
};

export const decodeFineCaptionTrackSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  attributes(element, ["id", "document", "timeline"], ["regions"]);
  const id = stringAttribute(element, "id");
  const document = reference(element, "document", narrativeTypes.captionDocument, resolveReference);
  const context = resolveTemporalContext({ element, resolveReference });
  const regions = element.attributes.regions === undefined ? undefined : reference(element, "regions", spatialTypes.regionTimeline, resolveReference);
  const records: SurfaceRecordDraft[] = [{ id: `${id}.header`, type: captionTypes.header,
    value: { kind: "inline", value: { id } }, range: element.range }];
  const components: SurfaceComponentDraft[] = [];
  const fragments: ReturnType<typeof sealGraphFragment>[] = [];
  const inputs: { name: string; type: SurfaceResolvedReference["type"] }[] = [{ name: "document", type: narrativeTypes.captionDocument }, { name: "timeline", type: timelineTypes.track }, { name: "header", type: captionTypes.header }];
  const bindings: Record<string, SurfaceResolvedReference["ref"]> = { document: document.ref, timeline: context.timeline.ref, header: { kind: "record", id: `${id}.header` } };
  const operations: FragmentOperation[] = [{ id: "create", producer: captionProducers.create,
    inputs: { document: input("document"), header: input("header") }, result: { kind: "output", name: "program" } }];
  let previous = "create", index = 0;
  for (const child of element.children) {
    if (child.kind === "text") { if (child.value.trim()) throw new Error("Caption Track accepts Use children."); continue; }
    if (localName(child.name) !== "Use") throw new Error("Caption Track accepts Use children.");
    attributes(child, ["style"], ["id", "role", ...temporalWindowAttributeNames]);
    assertEmptyElement(child);
    index += 1;
    const useId = optionalTextAttribute(child, "id") ?? `${id}.use.${index}`;
    const hasTime = temporalWindowAttributeNames.some(name => child.attributes[name] !== undefined);
    const temporal = createTemporalWindowProjection({ id: useId, ...context, resolveReference,
      element: hasTime ? child : { ...child, attributes: { ...child.attributes, during: "program" } } });
    records.push(...temporal.records); components.push(...temporal.components); fragments.push(...temporal.fragments);
    const style = reference(child, "style", captionTypes.style, resolveReference);
    const role = optionalTextAttribute(child, "role");
    const filterId = `${useId}.filter`;
    records.push({ id: filterId, type: captionTypes.filter, value: { kind: "inline", value: role === undefined ? {} : { role } }, range: child.range });
    const key = `use-${index}`;
    inputs.push({ name: `${key}-window`, type: temporalTypes.window }, { name: `${key}-style`, type: captionTypes.style }, { name: `${key}-filter`, type: captionTypes.filter });
    bindings[`${key}-window`] = temporal.ref; bindings[`${key}-style`] = style.ref; bindings[`${key}-filter`] = { kind: "record", id: filterId };
    operations.push({ id: key, producer: captionProducers.append,
      inputs: { program: operation(previous), window: input(`${key}-window`), style: input(`${key}-style`), filter: input(`${key}-filter`) }, result: { kind: "output", name: "program" } });
    previous = key;
  }
  operations.push({ id: "content", producer: captionProducers.temporalizeDocument,
    inputs: { document: input("document"), timeline: input("timeline") }, result: { kind: "output", name: "caption" } });
  operations.push({ id: "schedule", producer: captionFineProducers.schedule,
    inputs: { caption: operation("content"), document: input("document"), program: operation(previous) }, result: { kind: "output", name: "schedule" } });
  if (regions !== undefined) { inputs.push({ name: "regions", type: spatialTypes.regionTimeline }); bindings.regions = regions.ref; }
  operations.push({ id: "render", producer: regions === undefined ? captionFineProducers.render : captionFineProducers.renderWithRegions,
    inputs: { schedule: operation("schedule"), document: input("document"), timeline: input("timeline"), program: operation(previous), ...(regions === undefined ? {} : { regions: input("regions") }) }, result: { kind: "output", name: "track" } });
  const collector = sealGraphFragment({ inputs, operations, exports: [
    { name: "content", type: captionTypes.timedProjection, root: operation("content") },
    { name: "program", type: captionTypes.program, root: operation(previous) },
    { name: "schedule", type: captionFineTypes.schedule, root: operation("schedule") },
    { name: "track", type: compositionTypes.visualTrack, root: operation("render") },
  ] });
  fragments.push(collector);
  components.push({ id, fragment: collector.id, inputs: bindings,
    outputs: { content: `${id}.content`, program: `${id}.program`, schedule: `${id}.schedule`, track: `${id}.track` }, range: element.range });
  return { records, components, fragments, exports: [`${id}.content`, `${id}.program`, `${id}.schedule`, `${id}.track`] };
};
