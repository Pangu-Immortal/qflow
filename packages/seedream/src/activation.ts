import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { seedreamComponent, seedreamDefinition, seedreamManifest, seedreamModuleRef,
  seedreamMarkupSurfaces } from "./index.js";
import { decodeSeedreamReferenceImageSurface, decodeSeedreamTextImageSurface } from "./surface.js";
export const qflowPackage = { format: "qflow.package@1" as const, modules: [{ manifest: seedreamManifest }], facets: [
  createProducerPackageFacet(seedreamComponent),
  createAdmissionPackageFacet(seedreamComponent),
  seedreamDefinition.facet,
  createMarkupSurfaceFacet({ module: seedreamModuleRef,
    declaration: seedreamMarkupSurfaces.find((item) => item.name === "text-image")!, handler: decodeSeedreamTextImageSurface }),
  createMarkupSurfaceFacet({ module: seedreamModuleRef,
    declaration: seedreamMarkupSurfaces.find((item) => item.name === "reference-image")!, handler: decodeSeedreamReferenceImageSurface }),
] };
export default qflowPackage;
