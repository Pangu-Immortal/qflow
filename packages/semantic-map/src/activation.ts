import { semanticMapManifest } from "./index.js";
export const qflowPackage = { format: "qflow.node-package@1" as const, modules: [{ manifest: semanticMapManifest }] };
export default qflowPackage;
