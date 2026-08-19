import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  decodeScriptSurface,
  scriptManifest,
  scriptModuleRef,
  scriptMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: scriptManifest }],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: scriptModuleRef,
    declaration: scriptMarkupSurfaces.find((item) => item.name === "script")!,
    handler: decodeScriptSurface,
  })],
};

export default qflowPackage;
