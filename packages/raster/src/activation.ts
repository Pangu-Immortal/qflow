import { rasterManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: rasterManifest }],
};
export default qflowPackage;
