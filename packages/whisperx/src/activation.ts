import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import {
  decodeWhisperXAlignmentSurface, whisperXComponent,
  whisperXManifest, whisperXModuleRef,
  whisperXMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: whisperXManifest }],
  components: [whisperXComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: whisperXModuleRef,
    declaration: whisperXMarkupSurfaces.find((item) => item.name === "alignment")!,
    handler: decodeWhisperXAlignmentSurface,
  })],
};
export default qflowPackage;
