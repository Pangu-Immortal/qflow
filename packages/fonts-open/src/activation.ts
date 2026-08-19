import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  decodeOpenFontFaceSurface,
  decodeOpenFontStackSurface,
  fontsOpenManifest,
  fontsOpenModuleRef,
  fontsOpenMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{
    manifest: fontsOpenManifest,
  }],
  hostFacets: [
    createMarkupSurfaceHostFacet({
      module: fontsOpenModuleRef,
    declaration: fontsOpenMarkupSurfaces.find((item) => item.name === "face")!,
      handler: decodeOpenFontFaceSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: fontsOpenModuleRef,
    declaration: fontsOpenMarkupSurfaces.find((item) => item.name === "stack")!,
      handler: decodeOpenFontStackSurface,
    }),
  ],
};

export default qflowPackage;
