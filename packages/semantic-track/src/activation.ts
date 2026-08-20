import { semanticTrackComponent, semanticTrackManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: semanticTrackManifest }],
  components: [semanticTrackComponent],
};
export default qflowPackage;
