import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/markup";
import { decodeNarrativeProjectionSurface, narrativeProjectionMarkupSurface, narrativeTemporalComponent,
  narrativeTemporalManifest, narrativeTemporalModuleRef } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: narrativeTemporalManifest }],
  facets: [
    ...[narrativeTemporalComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),createMarkupSurfaceFacet({ module: narrativeTemporalModuleRef,
    declaration: narrativeProjectionMarkupSurface, handler: decodeNarrativeProjectionSurface })],
};
export default qflowPackage;
