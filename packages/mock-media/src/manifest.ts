import { artifactTypes } from "@qflow/artifact";
import { programSpaceTypes } from "@qflow/program-space";
import type { CapabilityRef, ModuleManifest, ProducerRef, TypeRef } from "@qflow/protocol";
import { spatialTypes } from "@qflow/spatial";
import { speechTypes } from "@qflow/speech";

export const mockMediaModuleRef = { name: "@qflow/mock-media", version: "1" } as const;
export const mockMediaTypes = {
  imageRequest: { module: mockMediaModuleRef, name: "MockImageRequest" },
  videoRequest: { module: mockMediaModuleRef, name: "MockVideoRequest" },
  silenceRequest: { module: mockMediaModuleRef, name: "MockSilenceRequest" },
} satisfies Record<string, TypeRef>;
export const mockMediaCapabilities = {
  image: { module: mockMediaModuleRef, name: "render-mock-image" },
  video: { module: mockMediaModuleRef, name: "render-mock-video" },
  silence: { module: mockMediaModuleRef, name: "render-mock-silence" },
} satisfies Record<string, CapabilityRef>;
export const mockMediaProducers = {
  image: { module: mockMediaModuleRef, name: "request-mock-image" },
  video: { module: mockMediaModuleRef, name: "request-mock-video" },
  silence: { module: mockMediaModuleRef, name: "request-mock-silence" },
} satisfies Record<string, ProducerRef>;

const canvas = { module: spatialTypes.canvas.module, name: spatialTypes.canvas.name } as const;
export const mockMediaManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: mockMediaModuleRef.name,
  version: mockMediaModuleRef.version,
  dependencies: [
    { module: { name: "@qflow/artifact", version: "1" } },
    { module: { name: "@qflow/program-space", version: "1" } },
    { module: { name: "@qflow/spatial", version: "1" } },
  { module: { name: "@qflow/speech", version: "1" } },
  ],
  types: Object.values(mockMediaTypes).map((item) => ({ name: item.name })),
  capabilities: Object.values(mockMediaCapabilities).map((item) => ({ name: item.name, returns: artifactTypes.blob })),
  producers: [
    { name: mockMediaProducers.image.name, inputs: [{ name: "canvas", type: canvas }], outputs: [], needs: [{ name: "image", capability: mockMediaCapabilities.image, returns: artifactTypes.blob }] },
    { name: mockMediaProducers.video.name, inputs: [{ name: "canvas", type: canvas }, { name: "duration", type: speechTypes.duration }, { name: "clock", type: programSpaceTypes.clock }], outputs: [], needs: [{ name: "video", capability: mockMediaCapabilities.video, returns: artifactTypes.blob }] },
    { name: mockMediaProducers.silence.name, inputs: [{ name: "duration", type: speechTypes.duration }], outputs: [], needs: [{ name: "audio", capability: mockMediaCapabilities.silence, returns: artifactTypes.blob }] },
  ],
};
