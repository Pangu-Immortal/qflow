import { createStudioTrackCompanionHostFacet } from "@qflow/studio-adapter";
import { deckTrackStudioTrackCompanions } from "./index.js";

export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioTrackCompanionHostFacet(deckTrackStudioTrackCompanions)],
};
