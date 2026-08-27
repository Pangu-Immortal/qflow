import { createRunFragmentHostFacet } from "@qflow/run";
import { mockImageFragment, mockMediaManifest, mockMediaModuleRef, mockSilenceFragment, mockVideoFragment } from "./index.js";
import { mockMediaComponent } from "./component.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: mockMediaManifest }],
  components: [mockMediaComponent],
  hostFacets: [createRunFragmentHostFacet({
    name: "@qflow/mock-media@1",
    fragments: { image: mockImageFragment, video: mockVideoFragment, silence: mockSilenceFragment },
  })],
};
export default qflowPackage;
