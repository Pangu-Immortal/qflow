import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { speechEvidenceComponent } from "./component.js";
import { speechEvidenceManifest } from "./index.js";
export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: speechEvidenceManifest }],
  facets: [...[speechEvidenceComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)])],
};
export default qflowPackage;
