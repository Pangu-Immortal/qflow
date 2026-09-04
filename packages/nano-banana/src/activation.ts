import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import {
  nanoBananaComponent, nanoBananaDefinition, nanoBananaManifest, nanoBananaModuleRef,
  nanoBananaMarkupSurfaces,
} from "./index.js";
import { decodeNanoBananaImageSurface, decodeNanoBananaProImageSurface } from "./surface.js";
export const qflowPackage = { format: "qflow.node-package@1" as const, modules: [{ manifest: nanoBananaManifest }], components: [nanoBananaComponent], hostFacets: [
  nanoBananaDefinition.hostFacet,
    ...(nanoBananaDefinition.runFragmentFacet === undefined ? [] : [nanoBananaDefinition.runFragmentFacet]),
  createMarkupSurfaceHostFacet({ module: nanoBananaModuleRef,
    declaration: nanoBananaMarkupSurfaces.find((item) => item.name === "image")!, handler: decodeNanoBananaImageSurface }),
  createMarkupSurfaceHostFacet({ module: nanoBananaModuleRef,
    declaration: nanoBananaMarkupSurfaces.find((item) => item.name === "pro-image")!, handler: decodeNanoBananaProImageSurface }),
] };
export default qflowPackage;
