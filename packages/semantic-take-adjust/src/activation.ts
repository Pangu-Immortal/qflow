import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  decodeSemanticTakeAdjustSurface,
  semanticTakeAdjustComponent,
  semanticTakeAdjustManifest,
  semanticTakeAdjustMarkupSurfaces,
  semanticTakeAdjustModuleRef,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: semanticTakeAdjustManifest }],
  components: [semanticTakeAdjustComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: semanticTakeAdjustModuleRef,
    declaration: semanticTakeAdjustMarkupSurfaces.find((item) => item.name === "semantic-take")!,
    handler: decodeSemanticTakeAdjustSurface,
  })],
};

export default qflowPackage;
