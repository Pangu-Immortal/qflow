import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { timelineComponent, timelineManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: timelineManifest }],
  facets: [...[timelineComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)])],
};
export default qflowPackage;
