import { createMarkupSurfaceHostFacet } from "qflow/author-kit";
import { decodeExampleSurface, exampleComponent, exampleManifest, exampleMarkupSurfaces, exampleModuleRef } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: exampleManifest }],
  components: [exampleComponent],
  hostFacets: exampleMarkupSurfaces.map((declaration) => createMarkupSurfaceHostFacet({ module: exampleModuleRef, declaration, handler: decodeExampleSurface })),
};
export default qflowPackage;
