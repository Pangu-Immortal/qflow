import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import { performanceManifest, performanceModuleRef, performanceMarkupSurfaces } from "./manifest.js";
import { performanceComponent } from "./component.js";
import { decodePerformanceStyleSurface, decodePerformanceTrackSurface } from "./surface.js";
export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: performanceManifest }], components: [performanceComponent],
  hostFacets: performanceMarkupSurfaces.map(declaration => createMarkupSurfaceHostFacet({ module: performanceModuleRef, declaration,
    handler: declaration.name === "style" ? decodePerformanceStyleSurface : decodePerformanceTrackSurface })),
};
export default qflowPackage;
