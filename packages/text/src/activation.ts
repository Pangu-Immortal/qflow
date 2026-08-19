import { createAuthorFrontendHostFacet } from "@qflow/elaborator";
import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  decodeTextRenderSurface,
  decodeTextValueSurface,
  textComponent,
  textManifest,
  textModuleRef,
  textSvsFrontend,
  textMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: textManifest }],
  components: [textComponent],
  hostFacets: [
    createAuthorFrontendHostFacet(textSvsFrontend),
    createMarkupSurfaceHostFacet({
      module: textModuleRef,
    declaration: textMarkupSurfaces.find((item) => item.name === "value")!,
      handler: decodeTextValueSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: textModuleRef,
    declaration: textMarkupSurfaces.find((item) => item.name === "render")!,
      handler: decodeTextRenderSurface,
    }),
  ],
};

export default qflowPackage;
