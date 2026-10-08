import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/markup";
import { decodeNarrativeInstantSurface, decodeNarrativeProjectionSurface, decodeNarrativeWindowSurface,
  narrativeProjectionMarkupSurfaces, narrativeTemporalComponent,
  narrativeTemporalManifest, narrativeTemporalModuleRef } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: narrativeTemporalManifest }],
  facets: [
    ...[narrativeTemporalComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createMarkupSurfaceFacet({ module: narrativeTemporalModuleRef,
      declaration: narrativeProjectionMarkupSurfaces.find((item) => item.name === "narrative-projection")!, handler: decodeNarrativeProjectionSurface }),
    createMarkupSurfaceFacet({ module: narrativeTemporalModuleRef,
      declaration: narrativeProjectionMarkupSurfaces.find((item) => item.name === "narrative-instant")!, handler: decodeNarrativeInstantSurface }),
    createMarkupSurfaceFacet({ module: narrativeTemporalModuleRef,
      declaration: narrativeProjectionMarkupSurfaces.find((item) => item.name === "narrative-window")!, handler: decodeNarrativeWindowSurface }),
  ],
};
export default qflowPackage;
