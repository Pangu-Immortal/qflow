import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import { decodeNarrativeProjectionSurface, narrativeProjectionMarkupSurface, narrativeTemporalComponent,
  narrativeTemporalManifest, narrativeTemporalModuleRef } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: narrativeTemporalManifest }],
  components: [narrativeTemporalComponent],
  hostFacets: [createMarkupSurfaceHostFacet({ module: narrativeTemporalModuleRef,
    declaration: narrativeProjectionMarkupSurface, handler: decodeNarrativeProjectionSurface })],
};
export default qflowPackage;
