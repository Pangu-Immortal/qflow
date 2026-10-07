import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";

import {
  decodeMimoVoiceCloneSurface,
  decodeMimoVoiceDesignSurface,
  mimoSpeechComponent,
  mimoSpeechDefinition,
  mimoSpeechManifest,
  mimoSpeechMarkupSurfaces,
  mimoSpeechModuleRef,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: mimoSpeechManifest }],
  facets: [
    ...[mimoSpeechComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    mimoSpeechDefinition.facet,
    createMarkupSurfaceFacet({
      module: mimoSpeechModuleRef,
      declaration: mimoSpeechMarkupSurfaces.find((item) => item.name === "voiceDesign")!,
      handler: decodeMimoVoiceDesignSurface,
    }),
    createMarkupSurfaceFacet({
      module: mimoSpeechModuleRef,
      declaration: mimoSpeechMarkupSurfaces.find((item) => item.name === "voiceClone")!,
      handler: decodeMimoVoiceCloneSurface,
    }),
  ],
};

export default qflowPackage;
