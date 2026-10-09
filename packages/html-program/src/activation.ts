import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { htmlProgramComponent, htmlProgramManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: htmlProgramManifest }],
  facets: [...[htmlProgramComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)])],
};
export default qflowPackage;
