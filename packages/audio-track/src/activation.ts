import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import {
  audioTrackComponent,
  audioTrackManifest,
  audioTrackModuleRef,
  decodeAudioTrackSurface,
  audioTrackMarkupSurfaces,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: audioTrackManifest }],
  components: [audioTrackComponent],
  hostFacets: [createMarkupSurfaceHostFacet({
    module: audioTrackModuleRef,
    declaration: audioTrackMarkupSurfaces.find((item) => item.name === "track")!,
    handler: decodeAudioTrackSurface,
  })],
};
export default qflowPackage;
