import { artifactDependency, artifactTypes } from "@qflow/artifact";
import { programSpaceDependency, programSpaceTypes } from "@qflow/program-space";
import type { CapabilityRef, ModuleManifest, TypeRef } from "@qflow/protocol";
import { spatialDependency, spatialTypes } from "@qflow/spatial";
import { speechDependency, speechTypes } from "@qflow/speech";

export const standInModuleRef = { name: "@qflow/stand-in", version: "1" } as const;
export const standInDependency = { module: standInModuleRef } as const;

export const standInTypes = {
  cardRequest: { module: standInModuleRef, name: "StandInCardRequest" },
  silenceRequest: { module: standInModuleRef, name: "StandInSilenceRequest" },
} satisfies Record<string, TypeRef>;

/** Draw one stand-in card. Served by a local media Provider; it draws, it never generates. */
export const standInCapabilities = {
  drawCard: { module: standInModuleRef, name: "draw-card" },
  drawSilence: { module: standInModuleRef, name: "draw-silence" },
} satisfies Record<string, CapabilityRef>;

export const standInProducers = {
  image: { module: standInModuleRef, name: "stand-in-image" },
  video: { module: standInModuleRef, name: "stand-in-video" },
  silence: { module: standInModuleRef, name: "stand-in-silence" },
} as const;

export const standInManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: standInModuleRef.name,
  version: standInModuleRef.version,
  dependencies: [artifactDependency, programSpaceDependency, spatialDependency, speechDependency],
  types: Object.values(standInTypes).map((item) => ({ name: item.name })),
  capabilities: Object.values(standInCapabilities).map((item) => ({ name: item.name, returns: artifactTypes.blob })),
  producers: [
    {
      name: standInProducers.image.name,
      inputs: [{ name: "canvas", type: spatialTypes.canvas }],
      outputs: [],
      needs: [{ name: "image", capability: standInCapabilities.drawCard, returns: artifactTypes.blob }],
    },
    {
      name: standInProducers.video.name,
      inputs: [
        { name: "canvas", type: spatialTypes.canvas },
        { name: "duration", type: speechTypes.duration },
        { name: "clock", type: programSpaceTypes.clock },
      ],
      outputs: [],
      needs: [{ name: "video", capability: standInCapabilities.drawCard, returns: artifactTypes.blob }],
    },
    {
      name: standInProducers.silence.name,
      inputs: [{ name: "duration", type: speechTypes.duration }],
      outputs: [],
      needs: [{ name: "audio", capability: standInCapabilities.drawSilence, returns: artifactTypes.blob }],
    },
  ],
};
