import { compositionComponent, compositionManifest } from "./index.js";
export const qflowPackage = { format: "qflow.node-package@1" as const, modules: [{ manifest: compositionManifest }], components: [compositionComponent] };
export default qflowPackage;
