import { createStudioCompanionHostFacet } from "@qflow/studio-adapter";
import { captionFineStudioTrackCompanions, captionFineStudioParameterCompanions } from "./index.js";

export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioCompanionHostFacet({ tracks: captionFineStudioTrackCompanions, parameters: captionFineStudioParameterCompanions })],
};
