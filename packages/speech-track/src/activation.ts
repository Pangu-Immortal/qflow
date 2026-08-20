import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import {
  decodeSpeechTrackSurface, speechTrackComponent, speechTrackManifest,
  speechTrackModuleRef,
  speechTrackMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{
    manifest: speechTrackManifest,
  }],
  components: [speechTrackComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: speechTrackModuleRef,
    declaration: speechTrackMarkupSurfaces.find((item) => item.name === "track")!, handler: decodeSpeechTrackSurface,
  })],
};
export default qflowPackage;
