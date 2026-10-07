import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { wanComponent, wanDefinition, wanManifest, wanModuleRef, wanMarkupSurfaces } from "./index.js";
import { decodeWanImageSurface, decodeWanProImageSurface } from "./surface.js";
export const qflowPackage = { format: "qflow.package@1" as const, modules: [{ manifest: wanManifest }], facets: [
  createProducerPackageFacet(wanComponent),
  createAdmissionPackageFacet(wanComponent),
  wanDefinition.facet,
  createMarkupSurfaceFacet({ module: wanModuleRef,
    declaration: wanMarkupSurfaces.find((item) => item.name === "image")!, handler: decodeWanImageSurface }),
  createMarkupSurfaceFacet({ module: wanModuleRef,
    declaration: wanMarkupSurfaces.find((item) => item.name === "pro-image")!, handler: decodeWanProImageSurface }),
] };
export default qflowPackage;
