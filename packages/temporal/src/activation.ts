import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { temporalManifest } from "./index.js";
import { temporalComponent } from "./component.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: temporalManifest }],
  facets: [...[temporalComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)])],
};
export default qflowPackage;
