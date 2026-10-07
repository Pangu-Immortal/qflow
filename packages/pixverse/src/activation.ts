import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import {
  pixverseComponent, pixverseDefinition, pixverseManifest, pixverseModuleRef, pixverseMarkupSurfaces,
} from "./index.js";
import { decodePixverseReferenceVideoSurface, decodePixverseVideoSurface } from "./surface.js";
export const qflowPackage = { format: "qflow.package@1" as const, modules: [{ manifest: pixverseManifest }], facets: [
  createProducerPackageFacet(pixverseComponent),
  createAdmissionPackageFacet(pixverseComponent),
  pixverseDefinition.facet,
  createMarkupSurfaceFacet({ module: pixverseModuleRef,
    declaration: pixverseMarkupSurfaces.find((item) => item.name === "video")!, handler: decodePixverseVideoSurface }),
  createMarkupSurfaceFacet({ module: pixverseModuleRef,
    declaration: pixverseMarkupSurfaces.find((item) => item.name === "reference-video")!, handler: decodePixverseReferenceVideoSurface }),
] };
export default qflowPackage;
