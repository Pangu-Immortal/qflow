import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";

import {
  decodeFishAudioVoiceCloneSurface,
  decodeFishAudioVoiceDesignSurface,
  fishAudioSpeechComponent,
  fishAudioSpeechDefinition,
  fishAudioSpeechManifest,
  fishAudioSpeechMarkupSurfaces,
  fishAudioSpeechModuleRef,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: fishAudioSpeechManifest }],
  facets: [
    ...[fishAudioSpeechComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    fishAudioSpeechDefinition.facet,
    createMarkupSurfaceFacet({
      module: fishAudioSpeechModuleRef,
      declaration: fishAudioSpeechMarkupSurfaces.find((item) => item.name === "voiceDesign")!,
      handler: decodeFishAudioVoiceDesignSurface,
    }),
    createMarkupSurfaceFacet({
      module: fishAudioSpeechModuleRef,
      declaration: fishAudioSpeechMarkupSurfaces.find((item) => item.name === "voiceClone")!,
      handler: decodeFishAudioVoiceCloneSurface,
    }),
  ],
};

export default qflowPackage;
