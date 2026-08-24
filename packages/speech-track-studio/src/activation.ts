import { createStudioAdapterHostFacet } from "@qflow/studio-adapter";
import { speechTrackStudioAdapters } from "./index.js";

export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioAdapterHostFacet(speechTrackStudioAdapters)],
};
