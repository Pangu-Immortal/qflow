import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";

import {
  decodeElevenLabsVoiceDesignSurface,
  elevenLabsSpeechComponent,
  elevenLabsSpeechDefinition,
  elevenLabsSpeechManifest,
  elevenLabsSpeechMarkupSurfaces,
  elevenLabsSpeechModuleRef,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: elevenLabsSpeechManifest }],
  facets: [
    ...[elevenLabsSpeechComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    elevenLabsSpeechDefinition.facet,
    createMarkupSurfaceFacet({
      module: elevenLabsSpeechModuleRef,
      declaration: elevenLabsSpeechMarkupSurfaces.find((item) => item.name === "voiceDesign")!,
      handler: decodeElevenLabsVoiceDesignSurface,
    }),
  ],
};

export default qflowPackage;
