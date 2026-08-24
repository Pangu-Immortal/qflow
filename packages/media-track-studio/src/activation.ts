import { createStudioAdapterHostFacet } from "@qflow/studio-adapter";
import { mediaTrackStudioAdapters } from "./index.js";

export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioAdapterHostFacet(mediaTrackStudioAdapters)],
};
