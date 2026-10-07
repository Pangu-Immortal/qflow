import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { minimaxH3Component, minimaxH3Definition, minimaxH3Manifest, minimaxH3ModuleRef,
  minimaxH3MarkupSurfaces } from "./index.js";
import { decodeMinimaxFrameVideoSurface, decodeMinimaxReferenceVideoSurface, decodeMinimaxTextVideoSurface } from "./surface.js";
export const qflowPackage = { format: "qflow.package@1" as const, modules: [{ manifest: minimaxH3Manifest }], facets: [
  createProducerPackageFacet(minimaxH3Component),
  createAdmissionPackageFacet(minimaxH3Component),
  minimaxH3Definition.facet,
  createMarkupSurfaceFacet({ module: minimaxH3ModuleRef,
    declaration: minimaxH3MarkupSurfaces.find((item) => item.name === "text-video")!, handler: decodeMinimaxTextVideoSurface }),
  createMarkupSurfaceFacet({ module: minimaxH3ModuleRef,
    declaration: minimaxH3MarkupSurfaces.find((item) => item.name === "frame-video")!, handler: decodeMinimaxFrameVideoSurface }),
  createMarkupSurfaceFacet({ module: minimaxH3ModuleRef,
    declaration: minimaxH3MarkupSurfaces.find((item) => item.name === "reference-video")!, handler: decodeMinimaxReferenceVideoSurface }),
] };
export default qflowPackage;
