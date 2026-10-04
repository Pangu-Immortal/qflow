import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import {
  decodeVisualTrackSurface,
  decodeVisualMotionSurface,
  decodeVisualSourceTimeSurface,
  visualTrackComponent,
  visualTrackManifest,
  visualTrackModuleRef,
  visualTrackMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: visualTrackManifest }],
  components: [visualTrackComponent],
  hostFacets: [
    createMarkupSurfaceHostFacet({
      module: visualTrackModuleRef,
      declaration: visualTrackMarkupSurfaces.find((item) => item.name === "track")!,
      handler: decodeVisualTrackSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: visualTrackModuleRef,
      declaration: visualTrackMarkupSurfaces.find((item) => item.name === "motion")!,
      handler: decodeVisualMotionSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: visualTrackModuleRef,
      declaration: visualTrackMarkupSurfaces.find((item) => item.name === "source-time")!,
      handler: decodeVisualSourceTimeSurface,
    }),
  ],
};
export default qflowPackage;
