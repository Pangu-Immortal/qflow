import { createMarkupSurfaceHostFacet } from "@qflow/markup";

import {
  decodeImageTransformProgramSurface,
  decodeImageTransformSurface,
  imageTransformComponent,
  imageTransformManifest,
  imageTransformModuleRef,
  imageTransformMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{
    manifest: imageTransformManifest,
  }],
  components: [imageTransformComponent],
  hostFacets: [{
    ...createMarkupSurfaceHostFacet({
      module: imageTransformModuleRef,
    declaration: imageTransformMarkupSurfaces.find((item) => item.name === "program")!,
      handler: decodeImageTransformProgramSurface,
    }),
  }, {
    ...createMarkupSurfaceHostFacet({
      module: imageTransformModuleRef,
    declaration: imageTransformMarkupSurfaces.find((item) => item.name === "transform")!,
      handler: decodeImageTransformSurface,
    }),
  }],
};

export default qflowPackage;
