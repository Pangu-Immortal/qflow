import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioCompanionFacet } from "@qflow/studio-companion";

import {
  decodeScriptSurface,
  scriptManifest,
  scriptModuleRef,
  scriptMarkupSurfaces,
} from "./index.js";
import { scriptStudioTemporalDomains } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: scriptManifest }],
  facets: [
    createMarkupSurfaceFacet({
      module: scriptModuleRef,
      declaration: scriptMarkupSurfaces.find((item) => item.name === "script")!,
      handler: decodeScriptSurface,
    }),
    createStudioCompanionFacet({ temporalDomains: scriptStudioTemporalDomains }),
  ],
};

export default qflowPackage;
