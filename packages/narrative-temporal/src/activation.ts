import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioCompanionFacet } from "@qflow/studio-companion";
import { decodeNarrativeInstantSurface, decodeNarrativeProjectionSurface, decodeNarrativeWindowSurface,
  narrativeProjectionMarkupSurfaces, narrativeTemporalComponent,
  narrativeTemporalManifest, narrativeTemporalModuleRef } from "./index.js";
import { narrativeStudioTemporalDeclarations, narrativeStudioTemporalRelations } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: narrativeTemporalManifest }],
  facets: [
    createStudioCompanionFacet({
      temporalDeclarations: narrativeStudioTemporalDeclarations,
      temporalRelations: narrativeStudioTemporalRelations,
    }),
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
