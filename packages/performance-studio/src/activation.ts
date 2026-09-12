import { createStudioCompanionHostFacet } from "@qflow/studio-adapter";
import { performanceStudioTrackCompanions, performanceStudioParameterCompanions } from "./index.js";
export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioCompanionHostFacet({ tracks: performanceStudioTrackCompanions, parameters: performanceStudioParameterCompanions })],
};
