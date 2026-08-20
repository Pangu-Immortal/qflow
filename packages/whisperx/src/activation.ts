import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import {
  decodeWhisperXSemanticTakeSurface, whisperXComponent,
  whisperXManifest, whisperXModuleRef,
  whisperXMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: whisperXManifest }],
  components: [whisperXComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: whisperXModuleRef,
    declaration: whisperXMarkupSurfaces.find((item) => item.name === "semantic-take")!,
    handler: decodeWhisperXSemanticTakeSurface,
  })],
};
export default qflowPackage;
