import type { ModuleManifest, TypeRef } from "@qflow/protocol";
import {
  narrativeSegmentRefSchema,
  narrativeSchema,
  narrativeMomentSchema,
  narrativeSelectionSchema,
} from "./schema.js";

export const narrativeModuleRef = { name: "@qflow/narrative", version: "1" } as const;
export const narrativeTypes = {
  narrative: { module: narrativeModuleRef, name: "Narrative" },
  segmentRef: { module: narrativeModuleRef, name: "NarrativeSegmentRef" },
  selection: { module: narrativeModuleRef, name: "NarrativeSelection" },
  moment: { module: narrativeModuleRef, name: "NarrativeMoment" },
} satisfies Record<string, TypeRef>;
export const narrativeManifest: ModuleManifest = {
  format: "qflow.module@1", name: narrativeModuleRef.name, version: narrativeModuleRef.version,
  dependencies: [],
  types: [
    { name: narrativeTypes.narrative.name },
    { name: narrativeTypes.segmentRef.name },
    { name: narrativeTypes.selection.name },
    { name: narrativeTypes.moment.name },
  ],
  capabilities: [], producers: [],
};
export const narrativeDependency = { module: narrativeModuleRef } as const;
