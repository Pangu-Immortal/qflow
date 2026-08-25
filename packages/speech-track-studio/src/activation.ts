import { createStudioTrackCompanionHostFacet } from "@qflow/studio-adapter";
import { speechTrackStudioTrackCompanions } from "./index.js";

export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioTrackCompanionHostFacet(speechTrackStudioTrackCompanions)],
};
