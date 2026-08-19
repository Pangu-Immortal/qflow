import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  decodeImageComposeSurface,
  imageComposeComponent,
  imageComposeManifest,
  imageComposeModuleRef,
  imageComposeMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: imageComposeManifest }],
  components: [imageComposeComponent],
  hostFacets: [{ ...createMarkupSurfaceHostFacet({
    module: imageComposeModuleRef,
    declaration: imageComposeMarkupSurfaces.find((item) => item.name === "image")!, handler: decodeImageComposeSurface,
  }) }],
};

export default qflowPackage;
