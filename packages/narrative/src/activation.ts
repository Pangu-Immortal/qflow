import { narrativeManifest } from "./index.js";
export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: narrativeManifest }],
};
export default qflowPackage;
