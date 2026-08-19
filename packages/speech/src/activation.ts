import { speechManifest } from "./index.js";
export const qflowPackage = { format: "qflow.node-package@1" as const, modules: [{ manifest: speechManifest }] };
export default qflowPackage;
