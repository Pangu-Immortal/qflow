import { speechBasisComponent, speechBasisManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: speechBasisManifest }],
  components: [speechBasisComponent],
};
export default qflowPackage;
