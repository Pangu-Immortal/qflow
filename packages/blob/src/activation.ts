import { blobManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: blobManifest }],
};

export default qflowPackage;
