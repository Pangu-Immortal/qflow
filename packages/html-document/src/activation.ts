import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { htmlDocumentManifest, htmlDocumentModuleRef, htmlDocumentMarkupSurfaces } from "./manifest.js";
import { htmlDocumentComponent } from "./component.js";
import { decodeHtmlDocumentSurface } from "./surface.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: htmlDocumentManifest }],
  facets: [
    createMarkupSurfaceFacet({ module: htmlDocumentModuleRef, declaration: htmlDocumentMarkupSurfaces[0], handler: decodeHtmlDocumentSurface }),
    createProducerPackageFacet(htmlDocumentComponent),
    createAdmissionPackageFacet(htmlDocumentComponent),
  ],
};
export default qflowPackage;
