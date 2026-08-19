import { speechAlignmentComponent, speechAlignmentManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: speechAlignmentManifest }],
  components: [speechAlignmentComponent],
};
export default qflowPackage;
