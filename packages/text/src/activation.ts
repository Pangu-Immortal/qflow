import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { createAuthorFrontendFacet } from "@qflow/author";
import { createMarkupSurfaceFacet } from "@qflow/markup";

import {
  decodeTextRenderSurface,
  decodeTextValueSurface,
  textComponent,
  textManifest,
  textModuleRef,
  textRecipeFrontend,
  textMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: textManifest }],
  facets: [
    ...[textComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createAuthorFrontendFacet(textRecipeFrontend),
    createMarkupSurfaceFacet({
      module: textModuleRef,
    declaration: textMarkupSurfaces.find((item) => item.name === "value")!,
      handler: decodeTextValueSurface,
    }),
    createMarkupSurfaceFacet({
      module: textModuleRef,
    declaration: textMarkupSurfaces.find((item) => item.name === "render")!,
      handler: decodeTextRenderSurface,
    }),
  ],
};

export default qflowPackage;
