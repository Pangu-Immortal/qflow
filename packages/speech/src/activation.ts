import { speechComponent, speechManifest } from "./index.js";
export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: speechManifest }],
  components: [speechComponent],
};
export default qflowPackage;
