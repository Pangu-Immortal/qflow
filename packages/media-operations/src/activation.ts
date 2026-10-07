import { createAdmissionPackageFacet } from "@qflow/qflow/admission";
import { createProducerPackageFacet } from "@qflow/qflow/producer";
import { createMarkupSurfaceFacet } from "@qflow/qflow/markup";
import { createRunFragmentFacet } from "@qflow/qflow/run";
import {
  decodeSynchronizedMediaSurface,
  decodeStillVideoSurface,
  decodeExtractAudioSurface,
  decodeExtractFrameSurface,
  decodeTransformMediaSurface,
  mediaOperationsComponent,
  mediaOperationsManifest,
  mediaOperationsModuleRef,
  mediaOperationsMarkupSurfaces,
  stillVideoFragment,
} from "./index.js";

export const qflowPackage = {
  format: "qflow.package@1" as const,
  modules: [{ manifest: mediaOperationsManifest }],
  facets: [
    ...[mediaOperationsComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),createRunFragmentFacet({
    name: "@qflow/media-operations@1",
    fragments: {
      "still-video": stillVideoFragment,
    },
  }), createMarkupSurfaceFacet({
    module: mediaOperationsModuleRef,
    declaration: mediaOperationsMarkupSurfaces.find((item) => item.name === "synchronized-media")!,
    handler: decodeSynchronizedMediaSurface,
  }), createMarkupSurfaceFacet({
    module: mediaOperationsModuleRef,
    declaration: mediaOperationsMarkupSurfaces.find((item) => item.name === "still-video")!,
    handler: decodeStillVideoSurface,
  }), createMarkupSurfaceFacet({
    module: mediaOperationsModuleRef,
    declaration: mediaOperationsMarkupSurfaces.find((item) => item.name === "transform-media")!,
    handler: decodeTransformMediaSurface,
  }), createMarkupSurfaceFacet({
    module: mediaOperationsModuleRef,
    declaration: mediaOperationsMarkupSurfaces.find((item) => item.name === "extract-audio")!,
    handler: decodeExtractAudioSurface,
  }), createMarkupSurfaceFacet({
    module: mediaOperationsModuleRef,
    declaration: mediaOperationsMarkupSurfaces.find((item) => item.name === "extract-frame")!,
    handler: decodeExtractFrameSurface,
  })],
};
export default qflowPackage;
