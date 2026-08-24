import { createStudioAdapterHostFacet } from "@qflow/studio-adapter";
import { typographyTrackStudioAdapters } from "./index.js";

export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioAdapterHostFacet(typographyTrackStudioAdapters)],
};
