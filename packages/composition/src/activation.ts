import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { compositionComponent, compositionManifest } from "./index.js";
export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: compositionManifest }],
  facets: [createAdmissionPackageFacet(compositionComponent)],
};
export default qflowPackage;
