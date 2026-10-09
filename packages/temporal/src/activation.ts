import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { temporalManifest } from "./index.js";
import { temporalComponent } from "./component.js";
import { createStudioCompanionFacet } from "@qflow/studio-companion";
import { commonTemporalStudioRelations } from "./studio.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: temporalManifest }],
  facets: [
    ...[temporalComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    createStudioCompanionFacet({ temporalRelations: commonTemporalStudioRelations }),
  ],
};
export default qflowPackage;
