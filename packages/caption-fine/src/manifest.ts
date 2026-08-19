import { captionManifest, captionModuleRef, captionTypes } from "@qflow/caption";
import { compositionDependency, compositionTypes } from "@qflow/composition";
import { mediaDependency } from "@qflow/media";
import { programSpaceDependency, programSpaceTypes } from "@qflow/program-space";
import { narrativeDependency, narrativeTypes } from "@qflow/narrative";
import { semanticMapDependency } from "@qflow/semantic-map";
import type { ModuleManifest, ProducerRef } from "@qflow/protocol";

export const captionFineModuleRef = { name: "@qflow/caption-fine", version: "1" } as const;
export const captionFineProducers = {
  render: { module: captionFineModuleRef, name: "render-fine-caption" },
} satisfies Record<string, ProducerRef>;

export const captionFineMarkupSurfaces = [
    {
      name: "style", tag: "Style", mode: "structured", outputs: [captionTypes.style],
    },
    {
      name: "track", tag: "Track", mode: "structured", outputs: [compositionTypes.visualTrack],
    },
  ] as const;


export const captionFineManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: captionFineModuleRef.name,
  version: captionFineModuleRef.version,
  dependencies: [
    { module: captionModuleRef },
    compositionDependency,
    mediaDependency,
    narrativeDependency,
    programSpaceDependency,
    semanticMapDependency,
  ],
  types: [],
  capabilities: [],
  producers: [{
    name: captionFineProducers.render.name,
    inputs: [
      { name: "caption", type: captionTypes.timedProjection },
      { name: "program", type: captionTypes.program },
      { name: "display", type: narrativeTypes.captionDisplay },
      { name: "space", type: programSpaceTypes.programSpace },
    ],
    outputs: [{ name: "track", type: compositionTypes.visualTrack }],
    needs: [],
  }],
};
