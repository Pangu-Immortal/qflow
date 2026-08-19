import { hyperframesComponent, hyperframesManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: hyperframesManifest }],
  components: [hyperframesComponent],
};
export default qflowPackage;
