import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import {
  nanoBananaComponent, nanoBananaDefinition, nanoBananaManifest, nanoBananaModuleRef,
  nanoBananaMarkupSurfaces,
} from "./index.js";
import { decodeNanoBananaImageSurface, decodeNanoBananaProImageSurface } from "./surface.js";
export const qflowPackage = { format: "qflow.package@1" as const, modules: [{ manifest: nanoBananaManifest }], facets: [
  createProducerPackageFacet(nanoBananaComponent),
  createAdmissionPackageFacet(nanoBananaComponent),
  nanoBananaDefinition.facet,
  createMarkupSurfaceFacet({ module: nanoBananaModuleRef,
    declaration: nanoBananaMarkupSurfaces.find((item) => item.name === "image")!, handler: decodeNanoBananaImageSurface }),
  createMarkupSurfaceFacet({ module: nanoBananaModuleRef,
    declaration: nanoBananaMarkupSurfaces.find((item) => item.name === "pro-image")!, handler: decodeNanoBananaProImageSurface }),
] };
export default qflowPackage;
