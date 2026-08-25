import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  decodeSemanticTakeEstimateSurface,
  semanticTakeEstimateComponent,
  semanticTakeEstimateManifest,
  semanticTakeEstimateMarkupSurfaces,
  semanticTakeEstimateModuleRef,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: semanticTakeEstimateManifest }],
  components: [semanticTakeEstimateComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: semanticTakeEstimateModuleRef,
    declaration: semanticTakeEstimateMarkupSurfaces.find((item) => item.name === "semantic-take")!,
    handler: decodeSemanticTakeEstimateSurface,
  })],
};

export default qflowPackage;
