import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioCompanionFacet } from "@qflow/studio-companion";
import {
  decodeFontsourceFaceSurface,
  fontsourceManifest,
  fontsourceMarkupSurfaces,
  fontsourceModuleRef,
  fontsourceStudioParameterCompanions,
} from "./index.js";

export default {
  format: "qflow.package@1" as const,
  modules: [{ manifest: fontsourceManifest }],
  facets: [
    createMarkupSurfaceFacet({
      module: fontsourceModuleRef,
      declaration: fontsourceMarkupSurfaces[0]!,
      handler: decodeFontsourceFaceSurface,
    }),
    createStudioCompanionFacet({ parameters: fontsourceStudioParameterCompanions }),
  ],
};
