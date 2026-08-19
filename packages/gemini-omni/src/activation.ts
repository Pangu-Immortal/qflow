import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import {
  geminiOmniComponent,
  geminiOmniManifest,
  geminiOmniModuleRef,
  geminiOmniMarkupSurfaces,
} from "./index.js";
import { decodeGeminiOmniVideoSurface } from "./surface.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: geminiOmniManifest }],
  components: [geminiOmniComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: geminiOmniModuleRef,
    declaration: geminiOmniMarkupSurfaces.find((item) => item.name === "video")!,
    handler: decodeGeminiOmniVideoSurface,
  })],
};
export default qflowPackage;
