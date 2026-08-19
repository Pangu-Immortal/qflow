import { generationComponent, generationManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: generationManifest }],
  components: [generationComponent],
};

export default qflowPackage;
