import { compositionDependency, compositionTypes } from "@qflow/composition";
import { compositableSurfaceSchema, mediaDependency } from "@qflow/media";
import type { ModuleManifest, ProducerRef, TypeRef, ValueSchema } from "@qflow/protocol";
import { VISUAL_IR_V1 } from "@qflow/visual-ir";
import { timelineDependency, timelineTypes } from "@qflow/timeline";

export const hyperframesModuleRef = { name: "@qflow/hyperframes", version: "1" } as const;
export const hyperframesTypes = {
  document: { module: hyperframesModuleRef, name: "HyperframesDocument" },
} satisfies Record<string, TypeRef>;
export const hyperframesProducers = {
  compile: { module: hyperframesModuleRef, name: "compile-composition" },
} satisfies Record<string, ProducerRef>;

const resource = { kind: "string", minLength: 5, maxLength: 256 } as const;
const positiveInteger = { kind: "number", integer: true, minimum: 1 } as const;
const nonNegativeInteger = { kind: "number", integer: true, minimum: 0 } as const;
export const hyperframesDocumentSchema: ValueSchema = {
  kind: "object",
  fields: {
    visualIr: { schema: { kind: "literal", value: VISUAL_IR_V1 } },
    frameRate: { schema: {
      kind: "object",
      fields: {
        numerator: { schema: positiveInteger },
        denominator: { schema: positiveInteger },
      },
    } },
    frameCount: { schema: positiveInteger },
    canvas: { schema: {
      kind: "object",
      fields: {
        width: { schema: positiveInteger },
        height: { schema: positiveInteger },
      },
    } },
    artifacts: { schema: { kind: "array", items: {
      kind: "object",
      fields: {
        artifact: { schema: { kind: "object", fields: {
          kind: { schema: { kind: "literal", value: "blob" } },
          resource: { schema: resource },
          size: { schema: nonNegativeInteger },
          mediaType: { schema: { kind: "string", minLength: 1 } },
        } } },
        usage: { schema: { kind: "oneOf", variants: [
          { kind: "object", fields: { kind: { schema: { kind: "literal", value: "always" } } } },
          { kind: "object", fields: {
            kind: { schema: { kind: "literal", value: "frames" } },
            spans: { schema: { kind: "array", minItems: 1, items: { kind: "object", fields: {
              startFrame: { schema: nonNegativeInteger },
              endFrameExclusive: { schema: positiveInteger },
            } } } },
          } },
        ] } },
      },
    } } },
    surfaces: { schema: { kind: "array", items: compositableSurfaceSchema } },
    html: { schema: { kind: "string", minLength: 1 } },
  },
};

export const hyperframesManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: hyperframesModuleRef.name,
  version: hyperframesModuleRef.version,
  dependencies: [compositionDependency, mediaDependency, timelineDependency],
  types: [{ name: hyperframesTypes.document.name }],
  capabilities: [],
  producers: [{
    name: hyperframesProducers.compile.name,
    inputs: [
      { name: "composition", type: compositionTypes.composition },
      { name: "timeline", type: timelineTypes.timeline },
    ],
    outputs: [{ name: "document", type: hyperframesTypes.document }],
    needs: [],
  }],
};
