import { speechEvidenceManifest } from "./index.js";
export const qflowPackage = { format: "qflow.node-package@1" as const, modules: [{ manifest: speechEvidenceManifest }] };
export default qflowPackage;
