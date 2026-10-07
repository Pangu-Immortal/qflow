import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import {
  decodeHtmlVideoSurface, htmlVideoManifest,
  htmlVideoModuleRef,
  htmlVideoMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: htmlVideoManifest }],
  facets: [createMarkupSurfaceFacet({
    module: htmlVideoModuleRef,
    declaration: htmlVideoMarkupSurfaces.find((item) => item.name === "video")!,
    handler: decodeHtmlVideoSurface,
  })],
};
export default qflowPackage;
