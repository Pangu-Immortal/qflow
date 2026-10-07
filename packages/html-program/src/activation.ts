import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { htmlProgramComponent, htmlProgramManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: htmlProgramManifest }],
  facets: [...[htmlProgramComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)])],
};
export default qflowPackage;
