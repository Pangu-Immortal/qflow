import { assertAttributes, assertEmptyElement, createMarkupSurfaceFacet, textAttribute } from "@qflow/qflow/markup";
import { canonicalize, sameType } from "@qflow/qflow/protocol";
import { sealGraphFragment } from "@qflow/qflow/author";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import type { ProducerPackage } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import type { ModuleManifest, TypeRef } from "@qflow/qflow/protocol";
import type { StructuredSurfaceHandler, SurfaceResolvedReference } from "@qflow/qflow/markup";
import { compositionTypes } from "@qflow/qflow/composition";
import { mediaTypes } from "@qflow/qflow/media";
import type { FontStackRef } from "@qflow/qflow/media";
import type { SynchronizedMedia } from "@qflow/qflow/media";
import { timelineTypes } from "@qflow/qflow/timeline";
import type { Timeline } from "@qflow/qflow/timeline";
import { spatialTypes } from "@qflow/qflow/spatial";
import type { SpatialFrame } from "@qflow/qflow/spatial";
import { temporalTypes } from "@qflow/qflow/temporal";
import type { TemporalInstant, TemporalWindow } from "@qflow/qflow/temporal";
import { createTemporalInstantConstruction, createTemporalWindowConstruction, temporalWindowAttributeNames,
  temporalWindowAttributeVocabulary, resolveTemporalContext } from "@qflow/qflow/temporal/markup";
import { temporalContextAttributeVocabulary } from "@qflow/qflow/temporal/markup";
import { renderExplainer } from "./render.js";
import type { ExplainerOptions } from "./render.js";

const module = { name: "@example/responsive-explainer", version: "1" } as const;
const optionsType = { module, name: "ExplainerOptions" };
const producer = { module, name: "compose" };
const inputs = [
  { name: "timeline", type: timelineTypes.timeline }, { name: "within", type: spatialTypes.frame },
  { name: "window", type: temporalTypes.window }, { name: "reveal", type: temporalTypes.instant },
  { name: "media", type: mediaTypes.synchronized }, { name: "sourceWindow", type: temporalTypes.window },
  { name: "font", type: mediaTypes.fontStack }, { name: "options", type: optionsType },
];
export const manifest: ModuleManifest = { format: "qflow.module@1", ...module,
  dependencies: [compositionTypes.visualTrack, mediaTypes.fontStack, timelineTypes.timeline,
    spatialTypes.frame, temporalTypes.window, temporalTypes.instant]
    .map(type => ({ module: type.module })),
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
const component: ProducerPackage & AdmissionPackage = { producers: [{ producer, handler: ({ inputs }) => ({ needs: {}, outputs: {
  visual: { kind: "inline", value: canonicalize(renderExplainer(inline<Timeline>(inputs.timeline),
    inline<SpatialFrame>(inputs.within), inline<TemporalWindow>(inputs.window), inline<TemporalInstant>(inputs.reveal),
    inline<SynchronizedMedia>(inputs.media), inline<TemporalWindow>(inputs.sourceWindow),
    inline<FontStackRef>(inputs.font).faces, inline<ExplainerOptions>(inputs.options))) },
} }) }] };
export const decodeSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "within", "font", "media", "source-window", "reveal", "title", "transition-frames", "stack-order", ...temporalWindowAttributeNames]);
  assertEmptyElement(element);
  const id = textAttribute(element, "id");
  const reference = (name: string, type: TypeRef): SurfaceResolvedReference => {
    const raw = element.attributes[name];
    if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${name} must be a reference.`);
    const value = resolveReference(raw.path);
    if (value === undefined || !sameType(type, value.type)) throw new Error(`${name} has the wrong type.`);
    return value;
  };
  const context = resolveTemporalContext({ element, resolveReference });
  const timeline = context.timeline;
  const window = createTemporalWindowConstruction({ id: `${id}.window`, element, ...context, resolveReference });
  // Reveal is already absolute; the outer Window independently controls this scene's lifetime.
  reference("reveal", temporalTypes.instant);
  const reveal = createTemporalInstantConstruction({ id: `${id}.reveal`,
    element: { ...element, attributes: { at: element.attributes.reveal! } }, ...context, resolveReference });
  const options: ExplainerOptions = { id, title: textAttribute(element, "title"),
    transitionFrames: Number(textAttribute(element, "transition-frames")), stackingOrder: Number(textAttribute(element, "stack-order")) };
  return { records: [...window.records, ...reveal.records, { id: `${id}.options`, type: optionsType,
      value: { kind: "inline", value: canonicalize(options) }, range: element.range }],
    fragments: [...window.fragments, ...reveal.fragments, fragment],
    components: [...window.components, ...reveal.components, { id, fragment: fragment.id,
      inputs: { timeline: timeline.ref, within: reference("within", spatialTypes.frame).ref,
        font: reference("font", mediaTypes.fontStack).ref,
        media: reference("media", mediaTypes.synchronized).ref,
        sourceWindow: reference("source-window", temporalTypes.window).ref,
        window: window.ref, reveal: reveal.ref,
        options: { kind: "record", id: `${id}.options` } }, outputs: { visual: `${id}.visual` }, range: element.range }],
    exports: [`${id}.visual`] };
};
const declaration = { name: "scene", tag: "Scene", mode: "structured" as const,
  outputs: [compositionTypes.visualTrack, temporalTypes.window, temporalTypes.instant, temporalTypes.duration,
    temporalTypes.extent, temporalTypes.shiftSpec, temporalTypes.windowSpec, temporalTypes.instantSpec, optionsType],
  vocabulary: { summary: "A continuously playing performance makes room for a diagram on a semantic Moment.",
    attributes: [
      ...["id", "title", "transition-frames", "stack-order"].map(name => ({ name, kind: "literal" as const, required: true, summary: name })),
      ...temporalContextAttributeVocabulary,
      ...[{ name: "within", type: spatialTypes.frame },
        { name: "font", type: mediaTypes.fontStack }, { name: "media", type: mediaTypes.synchronized },
        { name: "source-window", type: temporalTypes.window }, { name: "reveal", type: temporalTypes.instant }]
        .map(({ name, type }) => ({ name, kind: "reference" as const, required: true, accepts: [type], summary: name })),
      ...temporalWindowAttributeVocabulary,
    ], ports: [{ name: "visual", type: compositionTypes.visualTrack, summary: "The coordinated scene." }],
    example: '<explainer:Scene id="scene" timeline={speech.timeline} within={within} font={font} media={presenter.media} source-window={speech.presenter} during="timeline" reveal={story-time.reveal} title="How it works" transition-frames="18" stack-order="0"/>',
  },
};
export const qflowPackage = { format: "qflow.package@1" as const, modules: [{ manifest }],
  facets: [createProducerPackageFacet(component), createAdmissionPackageFacet(component),
    createMarkupSurfaceFacet({ module, declaration, handler: decodeSurface })] };
export default qflowPackage;
