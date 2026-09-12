import { createMarkupSurfaceHostFacet } from "@qflow/markup";

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
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: fishAudioSpeechManifest }],
  components: [fishAudioSpeechComponent],
  hostFacets: [
    fishAudioSpeechDefinition.hostFacet,
    createMarkupSurfaceHostFacet({
      module: fishAudioSpeechModuleRef,
      declaration: fishAudioSpeechMarkupSurfaces.find((item) => item.name === "voiceDesign")!,
      handler: decodeFishAudioVoiceDesignSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: fishAudioSpeechModuleRef,
      declaration: fishAudioSpeechMarkupSurfaces.find((item) => item.name === "voiceClone")!,
      handler: decodeFishAudioVoiceCloneSurface,
    }),
  ],
};

export default qflowPackage;
