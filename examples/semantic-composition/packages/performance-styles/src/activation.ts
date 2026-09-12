import { styleStudioFacet } from "./studio.js";
import { assertAttributes, assertEmptyElement, canonicalize, createMarkupSurfaceHostFacet, sameType, sealGraphFragment, textAttribute } from "@qflow/qflow/author-kit";
import type { ComponentPackage, ModuleManifest, StructuredSurfaceHandler, SurfaceResolvedReference } from "@qflow/qflow/author-kit";
import { compositionTypes } from "@qflow/qflow/composition";
import { performanceStyle, performanceTypes, performanceModuleRef } from "@qflow/qflow/performance";
import { timelineTypes } from "@qflow/qflow/timeline";
import type { Timeline } from "@qflow/qflow/timeline";
import { spatialTypes } from "@qflow/qflow/spatial";
import type { SpatialFrame } from "@qflow/qflow/spatial";
import { temporalTypes } from "@qflow/qflow/temporal";
import type { TemporalWindow } from "@qflow/qflow/temporal";
import { narrativeTypes } from "@qflow/qflow/narrative";
import type { NarrativeExcerpt } from "@qflow/qflow/narrative";
import { movingFrame, crossfade } from "./render.js";

const module = { name: "@example/performance-styles", version: "1" } as const;
const common = [{ name: "timeline", type: timelineTypes.track }, { name: "canvas", type: spatialTypes.canvas }, { name: "window", type: temporalTypes.window }];
const moveInputs = [...common, { name: "from", type: spatialTypes.frame }, { name: "to", type: spatialTypes.frame }];
const mixInputs = [...common, { name: "outgoing", type: narrativeTypes.excerpt }, { name: "incoming", type: narrativeTypes.excerpt }, { name: "frame", type: spatialTypes.frame }];
const families = [{ name: "move", tag: "Move", ports: moveInputs }, { name: "crossfade", tag: "Crossfade", ports: mixInputs }];
export const manifest: ModuleManifest = { format: "qflow.module@1", ...module,
  dependencies: [performanceModuleRef, compositionTypes.visualTrack.module, timelineTypes.track.module, spatialTypes.canvas.module, temporalTypes.window.module, narrativeTypes.excerpt.module].map(module => ({ module })),
  types: [], capabilities: [], producers: families.map(family => ({ name: family.name, inputs: family.ports, outputs: [{ name: "visual", type: compositionTypes.visualTrack }], needs: [] })) };
const fragments = families.map(family => sealGraphFragment({ inputs: family.ports,
  operations: [{ id: "render", producer: { module, name: family.name }, inputs: Object.fromEntries(family.ports.map(port => [port.name, { kind: "fragment-input" as const, name: port.name }])), result: { kind: "output", name: "visual" } }],
  exports: [{ name: "visual", type: compositionTypes.visualTrack, root: { kind: "fragment-operation", operation: "render" } }] }));
const component: ComponentPackage = { producers: families.map(family => ({ producer: { module, name: family.name }, handler: ({ inputs }) => {
  const values = Object.fromEntries(Object.entries(inputs).map(([key, record]) => {
    if (record.value.kind !== "inline") throw new Error(`${key} must be inline`);
    return [key, record.value.value];
  }));
  const visual = family.name === "move" ? movingFrame(values.timeline as unknown as Timeline, values.window as unknown as TemporalWindow, values.from as unknown as SpatialFrame, values.to as unknown as SpatialFrame)
    : crossfade(values.timeline as unknown as Timeline, values.window as unknown as TemporalWindow, values.outgoing as unknown as NarrativeExcerpt, values.incoming as unknown as NarrativeExcerpt, values.frame as unknown as SpatialFrame);
  return { outputs: { visual: { kind: "inline", value: canonicalize(visual) } }, needs: {} };
} })) };
const hostFacets = families.map((family,index) => {
  const params = family.ports.slice(common.length);
  const handler: StructuredSurfaceHandler = ({ element, resolveReference }) => {
    assertAttributes(element, ["id", ...params.map(port => port.name)]); assertEmptyElement(element);
    const bindings: Record<string, SurfaceResolvedReference> = {};
    for (const param of params) {
      const raw = element.attributes[param.name];
      if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${param.name} must be a reference`);
      const value = resolveReference(raw.path);
      if (value === undefined || !sameType(value.type,param.type)) throw new Error(`${param.name} has the wrong Type`);
      bindings[param.name] = value;
    }
    return { records: [{ id: textAttribute(element,"id"), type: performanceTypes.style,
      value: { kind: "inline", value: canonicalize(performanceStyle(fragments[index]!,bindings)) }, range: element.range }], components: [], fragments: [] };
  };
  return createMarkupSurfaceHostFacet({ module, declaration: { name: family.name, tag: family.tag, mode: "structured", outputs: [performanceTypes.style], vocabulary: {
    summary: `Project-owned ${family.name} presentation Style.`, example: `<styles:${family.tag} id="look" ${params.map(port => `${port.name}={${port.name}}`).join(' ')}/>`,
    attributes: [{ name: "id", kind: "identifier", required: true, summary: "Style identity." }, ...params.map(port => ({ name: port.name, kind: "reference" as const, required: true, accepts: [port.type], summary: `Explicit ${port.name} input.` }))],
  } }, handler });
});
export const qflowPackage = { format: "qflow.node-package@1" as const, modules: [{ manifest }], components: [component], hostFacets: [...hostFacets, styleStudioFacet(module)] };
export default qflowPackage;
