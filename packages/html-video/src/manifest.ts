import { temporalContextAttributeVocabulary } from "@qflow/qflow/temporal/markup";
import { blobDependency, blobTypes } from "@qflow/qflow/blob";
import { mediaDependency, mediaTypes } from "@qflow/qflow/media";
import { compositionDependency, compositionTypes } from "@qflow/qflow/composition";
import { timelineDependency } from "@qflow/qflow/timeline";
import { htmlProgramModuleRef } from "@qflow/qflow/html-program";
import type { ModuleManifest } from "@qflow/qflow/protocol";
import {
  mediaOperationsModuleRef,
} from "@qflow/media-operations";

export const htmlVideoModuleRef = { name: "@qflow/html-video", version: "1" } as const;
export const htmlVideoMarkupSurfaces = [{
    name: "video",
    tag: "Video",
    mode: "structured",
    outputs: [mediaTypes.frameRange],
    vocabulary: {
      summary:
        "Produces one final video from a Composition on its selected film time axis, publishing the muxed result as a Blob.",
      attributes: [
        { name: "id", kind: "identifier", required: true,
          summary: "Names this video assembly and the final video it publishes." },
        { name: "composition", kind: "reference", required: true,
          accepts: [compositionTypes.composition],
          summary: "Selects the Composition this element compiles, rasterizes and muxes." },
        ...temporalContextAttributeVocabulary,
        { name: "start-frame", kind: "literal", required: false, summary: "First original program frame to render; requires end-frame-exclusive." },
        { name: "end-frame-exclusive", kind: "literal", required: false, summary: "First excluded frame; requires start-frame." },
      ],
      ports: [
        { name: "video", type: blobTypes.blob,
          summary: "The final muxed video Artifact, addressed as `<id>.video`." },
      ],
      example: '<html:Video id="final" composition={main.composition} timeline={speech.timeline}/>',
      notes: [
        "Supply id, composition and timeline. Write both frame bounds to select a range. The element is empty.",
        "Visual rasterization, audio preparation and mux are three separate Needs, each realized by a Provider this package does not choose.",
        "The published Artifact carries no duration or lineage metadata, so a consumer that needs stream facts requests explicit media inspection.",
      ],
    },
  }] as const;


export const htmlVideoManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: htmlVideoModuleRef.name,
  version: htmlVideoModuleRef.version,
  dependencies: [
    blobDependency,
    mediaDependency,
    compositionDependency,
    timelineDependency,
    { module: htmlProgramModuleRef },
    { module: mediaOperationsModuleRef },
  ],
  types: [],
  capabilities: [],
  producers: [],
};
