import { createStudioTrackCompanionHostFacet } from "@qflow/studio-adapter";
import { audioTrackStudioTrackCompanions } from "./index.js";

export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioTrackCompanionHostFacet(audioTrackStudioTrackCompanions)],
};
