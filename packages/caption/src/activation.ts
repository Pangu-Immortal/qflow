import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/markup";
import {
  captionComponent, captionManifest, captionModuleRef,
  decodeHiddenCaptionStyleSurface,
  captionMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: captionManifest }],
  facets: [
    ...[captionComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({ module: captionModuleRef,
    declaration: captionMarkupSurfaces.find((item) => item.name === "hidden")!, handler: decodeHiddenCaptionStyleSurface }),
  ],
};
export default qflowPackage;
