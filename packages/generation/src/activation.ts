import { createAdmissionPackageFacet } from "@qflow/admission";
import { createProducerPackageFacet } from "@qflow/producer";
import { generationComponent, generationManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: generationManifest }],
  facets: [...[generationComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)])],
};

export default qflowPackage;
