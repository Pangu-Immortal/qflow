import { createStudioCompanionHostFacet } from "@qflow/studio-adapter";
import { soundStudioTrackCompanions, soundStudioParameterCompanions } from "./index.js";
export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioCompanionHostFacet({ tracks: soundStudioTrackCompanions, parameters: soundStudioParameterCompanions })],
};
