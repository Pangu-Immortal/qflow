import { createRunFrontendHostFacet } from "@qflow/run";

import { runMarkupFrontend } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [createRunFrontendHostFacet(runMarkupFrontend)],
};

export default qflowPackage;
