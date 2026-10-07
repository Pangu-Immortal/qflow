import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import {
  grokImagineComponent,
  grokImagineDefinition,
  grokImagineManifest,
  grokImagineModuleRef,
  grokImagineMarkupSurfaces,
} from "./index.js";
import { decodeGrokImaginePreviewVideoSurface, decodeGrokImagineVideoSurface } from "./surface.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: grokImagineManifest }],
  facets: [
    ...[grokImagineComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    grokImagineDefinition.facet,
    createMarkupSurfaceFacet({
      module: grokImagineModuleRef,
    declaration: grokImagineMarkupSurfaces.find((item) => item.name === "video")!,
      handler: decodeGrokImagineVideoSurface,
    }),
    createMarkupSurfaceFacet({
      module: grokImagineModuleRef,
    declaration: grokImagineMarkupSurfaces.find((item) => item.name === "preview-video")!,
      handler: decodeGrokImaginePreviewVideoSurface,
    }),
  ],
};
export default qflowPackage;
