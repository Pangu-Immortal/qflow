import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import {
  pixverseComponent, pixverseDefinition, pixverseManifest, pixverseModuleRef, pixverseMarkupSurfaces,
} from "./index.js";
import { decodePixverseReferenceVideoSurface, decodePixverseVideoSurface } from "./surface.js";
export const qflowPackage = { format: "qflow.node-package@1" as const, modules: [{ manifest: pixverseManifest }], components: [pixverseComponent], hostFacets: [
  pixverseDefinition.hostFacet,
  createMarkupSurfaceHostFacet({ module: pixverseModuleRef,
    declaration: pixverseMarkupSurfaces.find((item) => item.name === "video")!, handler: decodePixverseVideoSurface }),
  createMarkupSurfaceHostFacet({ module: pixverseModuleRef,
    declaration: pixverseMarkupSurfaces.find((item) => item.name === "reference-video")!, handler: decodePixverseReferenceVideoSurface }),
] };
export default qflowPackage;
