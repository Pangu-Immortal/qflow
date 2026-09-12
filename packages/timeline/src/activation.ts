import { timelineComponent, timelineManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: timelineManifest }],
  components: [timelineComponent],
};
export default qflowPackage;
