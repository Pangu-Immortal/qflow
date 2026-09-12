import { assertAttributes, assertEmptyElement, canonicalize, createMarkupSurfaceHostFacet, sameType, sealGraphFragment, textAttribute } from "@qflow/qflow/author-kit";
import type { ComponentPackage, ModuleManifest, StructuredSurfaceHandler, SurfaceResolvedReference } from "@qflow/qflow/author-kit";
import { compositionTypes } from "@qflow/qflow/composition";
import { soundStyle, soundTypes, soundModuleRef } from "@qflow/qflow/sound";
import { timelineTypes } from "@qflow/qflow/timeline";
import type { Timeline } from "@qflow/qflow/timeline";
import { temporalTypes } from "@qflow/qflow/temporal";
import type { TemporalWindow } from "@qflow/qflow/temporal";
import { narrativeTypes } from "@qflow/qflow/narrative";
import type { NarrativeExcerpt } from "@qflow/qflow/narrative";
import { crossfadeSound } from "./render.js";

const module = { name: "@example/sound-styles", version: "1" } as const;
const common = [{ name: "timeline", type: timelineTypes.track }, { name: "window", type: temporalTypes.window }];
const mixInputs = [...common, { name: "outgoing", type: narrativeTypes.excerpt }, { name: "incoming", type: narrativeTypes.excerpt }];
const families = [{ name: "crossfade", tag: "Crossfade", ports: mixInputs }];
export const manifest: ModuleManifest = { format: "qflow.module@1", ...module,
  dependencies: [soundModuleRef, compositionTypes.audioTrack.module, timelineTypes.track.module, temporalTypes.window.module, narrativeTypes.excerpt.module].map(module => ({ module })),
  types: [], capabilities: [], producers: families.map(family => ({ name: family.name, inputs: family.ports, outputs: [{ name: "audio", type: compositionTypes.audioTrack }], needs: [] })) };
const fragments = families.map(family => sealGraphFragment({ inputs: family.ports,
  operations: [{ id: "render", producer: { module, name: family.name }, inputs: Object.fromEntries(family.ports.map(port => [port.name, { kind: "fragment-input" as const, name: port.name }])), result: { kind: "output", name: "audio" } }],
  exports: [{ name: "audio", type: compositionTypes.audioTrack, root: { kind: "fragment-operation", operation: "render" } }] }));
const component: ComponentPackage = { producers: families.map(family => ({ producer: { module, name: family.name }, handler: ({ inputs }) => {
  const values = Object.fromEntries(Object.entries(inputs).map(([key, record]) => {
    if (record.value.kind !== "inline") throw new Error(`${key} must be inline`);
    return [key, record.value.value];
  }));
  const audio = crossfadeSound(values.timeline as unknown as Timeline, values.window as unknown as TemporalWindow,
    values.outgoing as unknown as NarrativeExcerpt, values.incoming as unknown as NarrativeExcerpt);
  return { outputs: { audio: { kind: "inline", value: canonicalize(audio) } }, needs: {} };
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
    return { records: [{ id: textAttribute(element,"id"), type: soundTypes.style,
      value: { kind: "inline", value: canonicalize(soundStyle(fragments[index]!,bindings)) }, range: element.range }], components: [], fragments: [] };
  };
  return createMarkupSurfaceHostFacet({ module, declaration: { name: family.name, tag: family.tag, mode: "structured", outputs: [soundTypes.style], vocabulary: {
    summary: `Project-owned ${family.name} presentation Style.`, example: `<styles:${family.tag} id="look" ${params.map(port => `${port.name}={${port.name}}`).join(' ')}/>`,
    attributes: [{ name: "id", kind: "identifier", required: true, summary: "Style identity." }, ...params.map(port => ({ name: port.name, kind: "reference" as const, required: true, accepts: [port.type], summary: `Explicit ${port.name} input.` }))],
  } }, handler });
});
export const qflowPackage = { format: "qflow.node-package@1" as const, modules: [{ manifest }], components: [component], hostFacets };
export default qflowPackage;
