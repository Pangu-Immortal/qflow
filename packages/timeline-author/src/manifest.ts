import { programSpaceDependency, programSpaceTypes, programSpaceMarkupSurfaces } from "@qflow/program-space";
import { semanticTakeSchema, speechDependency, speechTypes } from "@qflow/speech";
import { timelineDependency, timelineTypes } from "@qflow/timeline";
import type { ModuleManifest, ValueSchema } from "@qflow/protocol";
export const timelineAuthorModuleRef = { name: "@qflow/timeline-author", version: "1" } as const;
export const timelineAuthorTypes = {
  header: { module: timelineAuthorModuleRef, name: "TimelineAuthorHeader" },
  trackSet: { module: timelineAuthorModuleRef, name: "TimelineAuthorSet" },
} as const;
export const timelineAuthorProducers = {
  createSet: { module: timelineAuthorModuleRef, name: "create-track-set" },
  appendTake: { module: timelineAuthorModuleRef, name: "append-track-take" },
  assembleTrack: { module: timelineAuthorModuleRef, name: "assemble-timeline" },
} as const;
export const timelineAuthorHeaderSchema: ValueSchema = { kind: "object", fields: { id: { schema: { kind: "string", minLength: 1 } }, at: { optional: true, schema: { kind: "array", items: { kind: "string" } } }, end: { optional: true, schema: { kind: "string" } } } };
export const timelineAuthorSetSchema: ValueSchema = { kind: "object", fields: { takes: { schema: { kind: "array", items: { kind: "object", fields: { semantic: { schema: semanticTakeSchema } } } } } } };
export const timelineAuthorMarkupSurfaces = [{
  name: "timeline", tag: "Timeline", mode: "structured",
  outputs: [timelineAuthorTypes.header, timelineTypes.track],
  vocabulary: {
    summary: "Declares one complete Timeline, with zero or more prepared Takes placed within it.",
    attributes: [
      { name: "id", kind: "identifier", required: true, summary: "Names the Timeline output." },
      { name: "clock", kind: "reference", required: true, accepts: [programSpaceTypes.clock], summary: "Frame rate, available before material generation." },
      { name: "end", kind: "literal", required: false, summary: "Program end: fixed time or content.end with an optional offset; defaults to content.end." },
    ],
    children: [{ tag: "Take", cardinality: "many", summary: "A prepared SemanticTake in performance order.",
      attributes: [{ name: "source", kind: "reference", required: true, accepts: [speechTypes.semanticTake], summary: "The normalized, aligned performance." },
        { name: "at", kind: "literal", required: false, summary: "Absolute position or previous.end with an offset. Defaults to zero for the first Take and previous.end thereafter." }] }],
    ports: [
      { name: "timeline", type: timelineTypes.track, summary: "The complete time range, retaining placed material and any semantic evidence." },
    ],
    example: '<time:Clock id="clock" frame-rate="30"/><time:Timeline id="program" clock={clock} end="content.end+2s"><time:Take source={opening.take} at="2s"/><time:Take source={answer.take}/></time:Timeline>',
    notes: ["Performance, Sound and Caption present existing pictures, audio and words independently. Include their contributions explicitly in Film."],
  },
}, programSpaceMarkupSurfaces[0]] as const;
export const timelineAuthorManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: timelineAuthorModuleRef.name,
  version: timelineAuthorModuleRef.version,
  dependencies: [
    programSpaceDependency,
    speechDependency,
    timelineDependency,
  ],
  types: [
    { name: timelineAuthorTypes.header.name },
    { name: timelineAuthorTypes.trackSet.name },
  ],
  capabilities: [],
  producers: [
    {
      name: timelineAuthorProducers.createSet.name,
      inputs: [],
      outputs: [{ name: "set", type: timelineAuthorTypes.trackSet }],
      needs: [],
    },
    {
      name: timelineAuthorProducers.appendTake.name,
      inputs: [
        { name: "set", type: timelineAuthorTypes.trackSet },
        { name: "take", type: speechTypes.semanticTake },
      ],
      outputs: [{ name: "set", type: timelineAuthorTypes.trackSet }],
      needs: [],
    },
    {
      name: timelineAuthorProducers.assembleTrack.name,
      inputs: [
        { name: "header", type: timelineAuthorTypes.header },
        { name: "clock", type: programSpaceTypes.clock },
        { name: "set", type: timelineAuthorTypes.trackSet },
      ],
      outputs: [{ name: "track", type: timelineTypes.track }],
      needs: [],
    },
  ],
};
