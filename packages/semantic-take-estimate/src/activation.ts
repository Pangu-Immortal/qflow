import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import { createRunFragmentHostFacet } from "@qflow/run";

import {
  decodeSemanticTakeEstimateSurface,
  semanticTakeEstimateComponent,
  semanticTakeEstimateManifest,
  semanticTakeEstimateMarkupSurfaces,
  semanticTakeEstimateModuleRef,
} from "./index.js";
import { semanticTakeEstimateFragment } from "./fragment.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: semanticTakeEstimateManifest }],
  components: [semanticTakeEstimateComponent],
  hostFacets: [createRunFragmentHostFacet({
    name: "@qflow/semantic-take-estimate@1",
    fragments: { "semantic-take": semanticTakeEstimateFragment },
  }), createMarkupSurfaceHostFacet({
    module: semanticTakeEstimateModuleRef,
    declaration: semanticTakeEstimateMarkupSurfaces.find((item) => item.name === "semantic-take")!,
    handler: decodeSemanticTakeEstimateSurface,
  })],
};

export default qflowPackage;
