import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  decodeRegionTrackSurface,
  regionTrackComponent,
  regionTrackManifest,
  regionTrackMarkupSurface,
  regionTrackModuleRef,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: regionTrackManifest }],
  components: [regionTrackComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: regionTrackModuleRef,
    declaration: regionTrackMarkupSurface,
    handler: decodeRegionTrackSurface,
  })],
};
export default qflowPackage;
