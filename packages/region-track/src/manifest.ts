import type { ModuleManifest, ProducerRef, TypeRef } from "@qflow/protocol";
import { spatialDependency, spatialTypes } from "@qflow/spatial";
import { svsRecipeType } from "@qflow/svs";
import { timelineDependency, timelineTypes } from "@qflow/timeline";

export const regionTrackModuleRef = { name: "@qflow/region-track", version: "1" } as const;
export const regionTrackTypes = {
  track: { module: regionTrackModuleRef, name: "RegionTrack" },
} satisfies Record<string, TypeRef>;
export const regionTrackProducers = {
  resolve: { module: regionTrackModuleRef, name: "resolve-region-track" },
} satisfies Record<string, ProducerRef>;

export const regionTrackMarkupSurface = {
  name: "track", tag: "Track", mode: "structured", outputs: [regionTrackTypes.track],
  vocabulary: {
    summary: "Resolves externally prepared normalized regions into one frame-exact Region Track.",
    attributes: [
      { name: "id", kind: "identifier", required: true, summary: "Names the RegionTrack value." },
      { name: "within", kind: "reference", required: true, accepts: [spatialTypes.frame], summary: "Chooses the program-picture Frame normalized regions occupy." },
      { name: "timeline", kind: "reference", required: true, accepts: [timelineTypes.timeline], summary: "Chooses the Timeline whose Frames index the evidence." },
      { name: "recipe", kind: "reference", required: true, accepts: [svsRecipeType], summary: "Chooses a Recipe with one or more named region series.", recipe: [
        { name: "series", required: true, summary: "Lists {id, regions}; each regions array contains one normalized [x, y, width, height] or null per Timeline Frame." },
      ] },
    ],
    example: `<region:Track id="heads" within={vertical.bounds} timeline={program.timeline} recipe={tracking.heads.default}/>` ,
    notes: [
      "The element is empty; it accepts no children or text.",
      "Detection, identity association, interpolation and source-to-picture projection remain explicit preparation choices.",
      "The resolver performs no detection and never invents a missing region.",
    ],
  },
} as const;

export const regionTrackManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: regionTrackModuleRef.name,
  version: regionTrackModuleRef.version,
  dependencies: [spatialDependency, { module: svsRecipeType.module }, timelineDependency],
  types: [{ name: regionTrackTypes.track.name }],
  capabilities: [],
  producers: [{
    name: regionTrackProducers.resolve.name,
    inputs: [
      { name: "within", type: spatialTypes.frame },
      { name: "timeline", type: timelineTypes.timeline },
      { name: "recipe", type: svsRecipeType },
    ],
    outputs: [{ name: "track", type: regionTrackTypes.track }], needs: [],
  }],
};
export const regionTrackDependency = { module: regionTrackModuleRef } as const;
