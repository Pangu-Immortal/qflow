import { createMarkupSurfaceHostFacet } from "@qflow/markup";
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

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: textFineManifest }],
  components: [textFineComponent],
  hostFacets: [
    createMarkupSurfaceHostFacet({
      module: textFineModuleRef,
    declaration: textFineMarkupSurfaces.find((item) => item.name === "style")!, handler: decodeTypographyStyleSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: textFineModuleRef,
    declaration: textFineMarkupSurfaces.find((item) => item.name === "motion")!, handler: decodeTypographyMotionSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: textFineModuleRef,
    declaration: textFineMarkupSurfaces.find((item) => item.name === "path-motion")!, handler: decodeTypographyPathMotionSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: textFineModuleRef,
    declaration: textFineMarkupSurfaces.find((item) => item.name === "flow")!, handler: decodeTypographyFlowSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: textFineModuleRef,
    declaration: textFineMarkupSurfaces.find((item) => item.name === "point")!, handler: decodeTypographyPointSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: textFineModuleRef,
    declaration: textFineMarkupSurfaces.find((item) => item.name === "path")!, handler: decodeTypographyPathSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: textFineModuleRef,
    declaration: textFineMarkupSurfaces.find((item) => item.name === "mask")!, handler: decodeTypographyMaskSurface,
    }),
  ],
};
export default qflowPackage;
