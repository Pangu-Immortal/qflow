import { createAuthorFrontendFacet } from "@qflow/author";

import { recipeFrontend, recipeManifest } from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: recipeManifest }],
  facets: [createAuthorFrontendFacet(recipeFrontend)],
};

export default qflowPackage;
