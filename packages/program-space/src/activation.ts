import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import { decodeClockSurface } from "./surface.js";
import { programSpaceManifest, programSpaceMarkupSurfaces, programSpaceModuleRef } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: programSpaceManifest }],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: programSpaceModuleRef,
    declaration: programSpaceMarkupSurfaces.find((item) => item.name === "clock")!,
    handler: decodeClockSurface,
  })],
};
export default qflowPackage;
