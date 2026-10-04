import { captionDependency, captionTypes } from "@qflow/caption";
import { narrativeDependency } from "@qflow/narrative";
import type { ModuleManifest, ProducerRef, TypeRef } from "@qflow/protocol";
import { narrativeTemporalDependency, narrativeTemporalTypes } from "@qflow/narrative-temporal";

export const narrativeCaptionModuleRef = { name: "@qflow/narrative-caption", version: "1" } as const;
export const narrativeCaptionTypes = {
  binding: { module: narrativeCaptionModuleRef, name: "NarrativeCaptionBinding" },
} satisfies Record<string, TypeRef>;
export const narrativeCaptionProducers = {
  projectTiming: { module: narrativeCaptionModuleRef, name: "project-narrative-caption-timing" },
} satisfies Record<string, ProducerRef>;

export const narrativeCaptionManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: narrativeCaptionModuleRef.name,
  version: narrativeCaptionModuleRef.version,
  dependencies: [captionDependency, narrativeDependency, narrativeTemporalDependency],
  types: [{ name: narrativeCaptionTypes.binding.name }],
  capabilities: [],
  producers: [{
    name: narrativeCaptionProducers.projectTiming.name,
    inputs: [
      { name: "document", type: captionTypes.document },
      { name: "binding", type: narrativeCaptionTypes.binding },
      { name: "projection", type: narrativeTemporalTypes.narrativeProjection },
    ],
    outputs: [{ name: "timing", type: captionTypes.timing }],
    needs: [],
  }],
};
export const narrativeCaptionDependency = { module: narrativeCaptionModuleRef } as const;
