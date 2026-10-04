import { narrativeDependency, narrativeTypes } from "@qflow/narrative";
import type { ModuleManifest, ProducerRef, TypeRef } from "@qflow/protocol";
import { temporalDependency, temporalTypes } from "@qflow/temporal";
import { timelineDependency, timelineTypes } from "@qflow/timeline";

export const narrativeTemporalModuleRef = { name: "@qflow/narrative-temporal", version: "1" } as const;
export const narrativeTemporalTypes = {
  narrativeAlignment: { module: narrativeTemporalModuleRef, name: "NarrativeAlignment" },
  narrativeProjection: { module: narrativeTemporalModuleRef, name: "NarrativeProjection" },
  narrativeInstantSpec: { module: narrativeTemporalModuleRef, name: "NarrativeInstantSpec" },
  narrativeProjectionParts: { module: narrativeTemporalModuleRef, name: "NarrativeProjectionParts" },
  narrativeProjectionHeader: { module: narrativeTemporalModuleRef, name: "NarrativeProjectionHeader" },
} satisfies Record<string, TypeRef>;
export const narrativeTemporalProducers = {
  materializeSegmentBoundaries: { module: narrativeTemporalModuleRef, name: "materialize-segment-boundaries" },
  projectAlignment: { module: narrativeTemporalModuleRef, name: "project-narrative-alignment" },
  combineProjectionParts: { module: narrativeTemporalModuleRef, name: "combine-narrative-projection-parts" },
  finalizeProjection: { module: narrativeTemporalModuleRef, name: "finalize-narrative-projection" },
  projectSelectionInstant: { module: narrativeTemporalModuleRef, name: "project-selection-instant" },
  projectSegmentInstant: { module: narrativeTemporalModuleRef, name: "project-segment-instant" },
  projectMomentInstant: { module: narrativeTemporalModuleRef, name: "project-moment-instant" },
} satisfies Record<string, ProducerRef>;

export const narrativeTemporalManifest: ModuleManifest = {
  format: "qflow.module@1", name: narrativeTemporalModuleRef.name, version: narrativeTemporalModuleRef.version,
  dependencies: [narrativeDependency, temporalDependency, timelineDependency],
  types: Object.values(narrativeTemporalTypes).map((type) => ({ name: type.name })), capabilities: [], producers: [{
    name: narrativeTemporalProducers.materializeSegmentBoundaries.name,
    inputs: [{ name: "narrative", type: narrativeTypes.narrative }, { name: "segment", type: narrativeTypes.segmentRef },
      { name: "domain", type: temporalTypes.localDomain }],
    outputs: [{ name: "alignment", type: narrativeTemporalTypes.narrativeAlignment }], needs: [],
  }, {
    name: narrativeTemporalProducers.projectAlignment.name,
    inputs: [{ name: "alignment", type: narrativeTemporalTypes.narrativeAlignment },
      { name: "domain", type: temporalTypes.localDomain }, { name: "window", type: temporalTypes.window },
      { name: "timeline", type: timelineTypes.timeline }],
    outputs: [{ name: "parts", type: narrativeTemporalTypes.narrativeProjectionParts }], needs: [],
  }, {
    name: narrativeTemporalProducers.combineProjectionParts.name,
    inputs: [{ name: "left", type: narrativeTemporalTypes.narrativeProjectionParts }, { name: "right", type: narrativeTemporalTypes.narrativeProjectionParts }],
    outputs: [{ name: "parts", type: narrativeTemporalTypes.narrativeProjectionParts }], needs: [],
  }, {
    name: narrativeTemporalProducers.finalizeProjection.name,
    inputs: [{ name: "header", type: narrativeTemporalTypes.narrativeProjectionHeader },
      { name: "narrative", type: narrativeTypes.narrative }, { name: "timeline", type: timelineTypes.timeline },
      { name: "parts", type: narrativeTemporalTypes.narrativeProjectionParts }],
    outputs: [{ name: "projection", type: narrativeTemporalTypes.narrativeProjection }], needs: [],
  }, {
    name: narrativeTemporalProducers.projectSelectionInstant.name,
    inputs: [{ name: "timeline", type: timelineTypes.timeline }, { name: "projection", type: narrativeTemporalTypes.narrativeProjection },
      { name: "selection", type: narrativeTypes.selection }, { name: "spec", type: narrativeTemporalTypes.narrativeInstantSpec }],
    outputs: [{ name: "instant", type: temporalTypes.instant }], needs: [],
  }, {
    name: narrativeTemporalProducers.projectSegmentInstant.name,
    inputs: [{ name: "timeline", type: timelineTypes.timeline }, { name: "projection", type: narrativeTemporalTypes.narrativeProjection },
      { name: "segment", type: narrativeTypes.segmentRef }, { name: "spec", type: narrativeTemporalTypes.narrativeInstantSpec }],
    outputs: [{ name: "instant", type: temporalTypes.instant }], needs: [],
  }, {
    name: narrativeTemporalProducers.projectMomentInstant.name,
    inputs: [{ name: "timeline", type: timelineTypes.timeline }, { name: "projection", type: narrativeTemporalTypes.narrativeProjection },
      { name: "moment", type: narrativeTypes.moment }, { name: "spec", type: narrativeTemporalTypes.narrativeInstantSpec }],
    outputs: [{ name: "instant", type: temporalTypes.instant }], needs: [],
  }],
};
export const narrativeTemporalDependency = { module: narrativeTemporalModuleRef } as const;
