import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioCompanionFacet } from "@qflow/studio-companion";
import {
  decodeTypographyMotionSurface,
  decodeTypographyPathMotionSurface,
  decodeTypographyMaskSurface,
  decodeTypographyFlowSurface,
  decodeTypographyPointSurface,
  decodeTypographyPathSurface,
  decodeTypographyStyleSurface,
  textFineComponent,
  textFineManifest,
  textFineModuleRef,
  textFineMarkupSurfaces,
} from "./index.js";
import { textFineStudioTrackCompanions } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: textFineManifest }],
  facets: [
    ...[textFineComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({
      module: textFineModuleRef,
      declaration: textFineMarkupSurfaces.find((item) => item.name === "style")!, handler: decodeTypographyStyleSurface,
    }),
    createMarkupSurfaceFacet({
      module: textFineModuleRef,
      declaration: textFineMarkupSurfaces.find((item) => item.name === "motion")!, handler: decodeTypographyMotionSurface,
    }),
    createMarkupSurfaceFacet({
      module: textFineModuleRef,
      declaration: textFineMarkupSurfaces.find((item) => item.name === "path-motion")!, handler: decodeTypographyPathMotionSurface,
    }),
    createMarkupSurfaceFacet({
      module: textFineModuleRef,
      declaration: textFineMarkupSurfaces.find((item) => item.name === "flow")!, handler: decodeTypographyFlowSurface,
    }),
    createMarkupSurfaceFacet({
      module: textFineModuleRef,
      declaration: textFineMarkupSurfaces.find((item) => item.name === "point")!, handler: decodeTypographyPointSurface,
    }),
    createMarkupSurfaceFacet({
      module: textFineModuleRef,
      declaration: textFineMarkupSurfaces.find((item) => item.name === "path")!, handler: decodeTypographyPathSurface,
    }),
    createMarkupSurfaceFacet({
      module: textFineModuleRef,
      declaration: textFineMarkupSurfaces.find((item) => item.name === "mask")!, handler: decodeTypographyMaskSurface,
    }),
    createStudioCompanionFacet({ tracks: textFineStudioTrackCompanions }),
  ],
};
export default qflowPackage;
