import { createMarkupSurfaceHostFacet } from "@qflow/markup";
import { createRunFragmentHostFacet } from "@qflow/run";
import {
  decodeSynchronizedMediaSurface,
  decodeStillVideoSurface,
  decodeExtractAudioSurface,
  decodeExtractFrameSurface,
  decodeTransformMediaSurface,
  mediaPipelineComponent,
  mediaPipelineManifest,
  mediaPipelineModuleRef,
  mediaPipelineMarkupSurfaces,
  stillVideoFragment,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  modules: [{ manifest: mediaPipelineManifest }],
  components: [mediaPipelineComponent],
  hostFacets: [createRunFragmentHostFacet({
    name: "@qflow/media-pipeline@1",
    fragments: {
      "still-video": stillVideoFragment,
    },
  }), createMarkupSurfaceHostFacet({
    module: mediaPipelineModuleRef,
    declaration: mediaPipelineMarkupSurfaces.find((item) => item.name === "synchronized-media")!,
    handler: decodeSynchronizedMediaSurface,
  }), createMarkupSurfaceHostFacet({
    module: mediaPipelineModuleRef,
    declaration: mediaPipelineMarkupSurfaces.find((item) => item.name === "still-video")!,
    handler: decodeStillVideoSurface,
  }), createMarkupSurfaceHostFacet({
    module: mediaPipelineModuleRef,
    declaration: mediaPipelineMarkupSurfaces.find((item) => item.name === "transform-media")!,
    handler: decodeTransformMediaSurface,
  }), createMarkupSurfaceHostFacet({
    module: mediaPipelineModuleRef,
    declaration: mediaPipelineMarkupSurfaces.find((item) => item.name === "extract-audio")!,
    handler: decodeExtractAudioSurface,
  }), createMarkupSurfaceHostFacet({
    module: mediaPipelineModuleRef,
    declaration: mediaPipelineMarkupSurfaces.find((item) => item.name === "extract-frame")!,
    handler: decodeExtractFrameSurface,
  })],
};
export default qflowPackage;
