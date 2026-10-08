import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createStudioCompanionFacet } from "@qflow/studio-companion";
import {
  decodeAbsoluteInstantSurface, decodeAbsoluteWindowSurface, decodeClockSurface, decodeTimelineAuthorSurface, timelineAuthorComponent, timelineAuthorManifest,
  timelineAuthorModuleRef,
  timelineAuthorMarkupSurfaces,
} from "./index.js";
import { timelineAuthorStudioTemporalDeclarations, timelineAuthorStudioTemporalRelations } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{
    manifest: timelineAuthorManifest,
  }],
  facets: [
    createStudioCompanionFacet({
      temporalDeclarations: timelineAuthorStudioTemporalDeclarations,
      temporalRelations: timelineAuthorStudioTemporalRelations,
    }),
    ...[timelineAuthorComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),createMarkupSurfaceFacet({
    module: timelineAuthorModuleRef,
    declaration: timelineAuthorMarkupSurfaces.find((item) => item.name === "timeline")!, handler: decodeTimelineAuthorSurface,
  }), createMarkupSurfaceFacet({ module: timelineAuthorModuleRef,
    declaration: timelineAuthorMarkupSurfaces.find(item => item.name === "clock")!, handler: decodeClockSurface,
  }), createMarkupSurfaceFacet({ module: timelineAuthorModuleRef,
    declaration: timelineAuthorMarkupSurfaces.find(item => item.name === "window")!, handler: decodeAbsoluteWindowSurface,
  }), createMarkupSurfaceFacet({ module: timelineAuthorModuleRef,
    declaration: timelineAuthorMarkupSurfaces.find(item => item.name === "instant")!, handler: decodeAbsoluteInstantSurface,
  })],
};
export default qflowPackage;
