import { createRunFrontendFacet } from "@qflow/run";

import { runMarkupFrontend } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  facets: [createRunFrontendFacet(runMarkupFrontend)],
};

export default qflowPackage;
