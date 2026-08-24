import { createStudioAdapterHostFacet } from "@qflow/studio-adapter";

import { videoStudioAdapters } from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [createStudioAdapterHostFacet(videoStudioAdapters)],
};

export default qflowPackage;
