import { assertAttributes, assertEmptyElement, canonicalize, createMarkupSurfaceHostFacet, sameType,
  sealGraphFragment, textAttribute } from "@qflow/qflow/author-kit";
import type { ComponentPackage, ModuleManifest, StructuredSurfaceHandler, SurfaceResolvedReference, TypeRef } from "@qflow/qflow/author-kit";
import { compositionTypes } from "@qflow/qflow/composition";
import { mediaTypes } from "@qflow/qflow/media";
import type { FontStackRef } from "@qflow/qflow/media";
import { narrativeTypes } from "@qflow/qflow/narrative";
import { timelineTypes } from "@qflow/qflow/timeline";
import type { Timeline } from "@qflow/qflow/timeline";
import { spatialTypes } from "@qflow/qflow/spatial";
import type { CanvasSpace } from "@qflow/qflow/spatial";
import { temporalTypes } from "@qflow/qflow/temporal";
import type { TemporalInstant, TemporalWindow } from "@qflow/qflow/temporal";
import { createTemporalInstantProjection, createTemporalWindowProjection, temporalWindowAttributeNames,
  temporalWindowAttributeVocabulary } from "@qflow/qflow/temporal-markup";
import { renderExplainer } from "./render.js";
import type { ExplainerOptions } from "./render.js";

const module = { name: "@example/responsive-explainer", version: "1" } as const;
const optionsType = { module, name: "ExplainerOptions" };
const producer = { module, name: "compose" };
const inputs = [
  { name: "timeline", type: timelineTypes.track }, { name: "canvas", type: spatialTypes.canvas },
  { name: "window", type: temporalTypes.window }, { name: "reveal", type: temporalTypes.instant },
  { name: "font", type: mediaTypes.fontStack }, { name: "options", type: optionsType },
];
export const manifest: ModuleManifest = { format: "qflow.module@1", ...module,
  dependencies: [compositionTypes.visualTrack, mediaTypes.fontStack, timelineTypes.track,
    spatialTypes.canvas, temporalTypes.window].map(type => ({ module: type.module })),
  types: [{ name: optionsType.name }], capabilities: [],
  producers: [{ name: producer.name, inputs, outputs: [{ name: "visual", type: compositionTypes.visualTrack }], needs: [] }],
};
const fragment = sealGraphFragment({ inputs, operations: [{ id: "compose", producer,
  inputs: Object.fromEntries(inputs.map(input => [input.name, { kind: "fragment-input" as const, name: input.name }])),
  result: { kind: "output", name: "visual" } }],
  exports: [{ name: "visual", type: compositionTypes.visualTrack, root: { kind: "fragment-operation", operation: "compose" } }],
});
const inline = <T>(record: { value: { kind: string; value?: unknown } } | undefined): T => {
  if (record?.value.kind !== "inline") throw new Error("Explainer inputs must be inline values.");
  return record.value.value as T;
};
const component: ComponentPackage = { producers: [{ producer, handler: ({ inputs }) => ({ needs: {}, outputs: {
  visual: { kind: "inline", value: canonicalize(renderExplainer(inline<Timeline>(inputs.timeline),
    inline<CanvasSpace>(inputs.canvas), inline<TemporalWindow>(inputs.window), inline<TemporalInstant>(inputs.reveal),
    inline<FontStackRef>(inputs.font).faces, inline<ExplainerOptions>(inputs.options))) },
} }) }] };
export const decodeSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "canvas", "font", "reveal", "title", "transition-frames", "stack-order", ...temporalWindowAttributeNames]);
  assertEmptyElement(element);
  const id = textAttribute(element, "id");
  const reference = (name: string, type: TypeRef): SurfaceResolvedReference => {
    const raw = element.attributes[name];
    if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${name} must be a reference.`);
    const value = resolveReference(raw.path);
    if (value === undefined || !sameType(type, value.type)) throw new Error(`${name} has the wrong type.`);
    return value;
  };
  const timeline = reference("timeline", timelineTypes.track);
  const window = createTemporalWindowProjection({ id: `${id}.window`, element, timeline, resolveReference });
  // Reveal has its own Moment; the outer Window independently controls this scene's lifetime.
  reference("reveal", narrativeTypes.moment);
  const reveal = createTemporalInstantProjection({ id: `${id}.reveal`,
    element: { ...element, attributes: { at: element.attributes.reveal! } }, timeline, resolveReference });
  const options: ExplainerOptions = { id, title: textAttribute(element, "title"),
    transitionFrames: Number(textAttribute(element, "transition-frames")), stackingOrder: Number(textAttribute(element, "stack-order")) };
  return { records: [...window.records, ...reveal.records, { id: `${id}.options`, type: optionsType,
      value: { kind: "inline", value: canonicalize(options) }, range: element.range }],
    fragments: [...window.fragments, ...reveal.fragments, fragment],
    components: [...window.components, ...reveal.components, { id, fragment: fragment.id,
      inputs: { timeline: timeline.ref, canvas: reference("canvas", spatialTypes.canvas).ref,
        font: reference("font", mediaTypes.fontStack).ref, window: window.ref, reveal: reveal.ref,
        options: { kind: "record", id: `${id}.options` } }, outputs: { visual: `${id}.visual` }, range: element.range }],
    exports: [`${id}.visual`] };
};
const declaration = { name: "scene", tag: "Scene", mode: "structured" as const,
  outputs: [compositionTypes.visualTrack, temporalTypes.window, temporalTypes.instant, temporalTypes.windowSpec, temporalTypes.instantSpec, optionsType],
  vocabulary: { summary: "A continuously playing performance makes room for a diagram on a semantic Moment.",
    attributes: [
      ...["id", "title", "transition-frames", "stack-order"].map(name => ({ name, kind: "literal" as const, required: true, summary: name })),
      ...[{ name: "timeline", type: timelineTypes.track }, { name: "canvas", type: spatialTypes.canvas },
        { name: "font", type: mediaTypes.fontStack }, { name: "reveal", type: narrativeTypes.moment }]
        .map(({ name, type }) => ({ name, kind: "reference" as const, required: true, accepts: [type], summary: name })),
      ...temporalWindowAttributeVocabulary,
    ], ports: [{ name: "visual", type: compositionTypes.visualTrack, summary: "The coordinated scene." }],
    example: '<explainer:Scene id="scene" timeline={speech.timeline} canvas={canvas} font={font} during="program" reveal={story.moment.reveal} title="How it works" transition-frames="18" stack-order="0"/>',
  },
};
export const qflowPackage = { format: "qflow.node-package@1" as const, modules: [{ manifest }], components: [component],
  hostFacets: [createMarkupSurfaceHostFacet({ module, declaration, handler: decodeSurface })] };
export default qflowPackage;
