import { standInComponent, standInManifest } from "./index.js";
import { createRunFragmentHostFacet } from "@qflow/run";
import { standInImageFragment, standInSilenceFragment, standInVideoFragment } from "./fragment.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: standInManifest }],
  components: [standInComponent],
  hostFacets: [createRunFragmentHostFacet({
    name: "@qflow/stand-in@1",
    fragments: {
      image: standInImageFragment,
      video: standInVideoFragment,
      silence: standInSilenceFragment,
    },
  })],
};

export default qflowPackage;
