import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { narrativeComponent, narrativeManifest } from "./index.js";
export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: narrativeManifest }],
  facets: [...[narrativeComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)])],
};
export default qflowPackage;
