import { createMarkupSurfaceHostFacet } from "@qflow/markup";

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
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: mimoSpeechManifest }],
  components: [mimoSpeechComponent],
  hostFacets: [
    mimoSpeechDefinition.hostFacet,
    createMarkupSurfaceHostFacet({
      module: mimoSpeechModuleRef,
      declaration: mimoSpeechMarkupSurfaces.find((item) => item.name === "voiceDesign")!,
      handler: decodeMimoVoiceDesignSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: mimoSpeechModuleRef,
      declaration: mimoSpeechMarkupSurfaces.find((item) => item.name === "voiceClone")!,
      handler: decodeMimoVoiceCloneSurface,
    }),
  ],
};

export default qflowPackage;
