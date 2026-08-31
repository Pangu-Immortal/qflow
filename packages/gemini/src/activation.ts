import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  decodeGeminiGenerateSurface,
  geminiComponent,
  geminiManifest,
  geminiMarkupSurfaces,
  geminiModuleRef,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: geminiManifest }],
  components: [geminiComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: geminiModuleRef,
    declaration: geminiMarkupSurfaces[0],
    handler: decodeGeminiGenerateSurface,
  })],
};

export default qflowPackage;
