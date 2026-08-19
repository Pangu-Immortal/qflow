import { createAuthorFrontendHostFacet } from "@qflow/elaborator";

import { svsFrontend, svsManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: svsManifest }],
  hostFacets: [createAuthorFrontendHostFacet(svsFrontend)],
};

export default qflowPackage;
