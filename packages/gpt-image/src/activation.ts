import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";

import {
  gptImageCleanManifest,
  gptImageCleanModuleRef,
  gptImageComponent,
  gptImageDefinition,
  gptImageManifest,
  gptImageMarkupSurfaces,
  gptImageModuleRef,
  gptImageCleanMarkupSurfaces,
} from "./index.js";
import {
  decodeCleanGptImageSurface,
  decodeGptImageSurface,
} from "./surface.js";
export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{
    manifest: gptImageManifest,
  }, {
    manifest: gptImageCleanManifest,
  }],
  facets: [
    ...[gptImageComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    gptImageDefinition.facet,
    createMarkupSurfaceFacet({
      module: gptImageModuleRef,
    declaration: gptImageMarkupSurfaces.find((item) => item.name === "image")!,
      handler: decodeGptImageSurface,
    }),
    createMarkupSurfaceFacet({
      module: gptImageCleanModuleRef,
    declaration: gptImageCleanMarkupSurfaces.find((item) => item.name === "image")!,
      handler: decodeCleanGptImageSurface,
    }),
  ],
};
export default qflowPackage;
