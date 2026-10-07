import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { decodeExampleSurface, exampleComponent, exampleManifest, exampleMarkupSurfaces, exampleModuleRef } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: exampleManifest }],
  facets: [
    createProducerPackageFacet(exampleComponent),
    createAdmissionPackageFacet(exampleComponent),
    ...exampleMarkupSurfaces.map((declaration) => createMarkupSurfaceFacet({ module: exampleModuleRef, declaration, handler: decodeExampleSurface })),
  ],
};
export default qflowPackage;
