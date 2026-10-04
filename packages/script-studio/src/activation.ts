import { createStudioCompanionHostFacet } from "@qflow/studio-adapter";

import { scriptStudioTemporalDomains } from "./index.js";

export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioCompanionHostFacet({ temporalDomains: scriptStudioTemporalDomains })],
};
