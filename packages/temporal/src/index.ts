import type { ModuleManifest } from "@qflow/protocol";

export * from "./location.js";
export * from "./projection.js";
export * from "./schedule.js";
export * from "./sample.js";
export type * from "./types.js";

export const temporalModuleRef = { name: "@qflow/temporal", version: "1" } as const;
export const temporalManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: temporalModuleRef.name,
  version: temporalModuleRef.version,
  dependencies: [],
  types: [],
  capabilities: [],
  producers: [],
};
export const temporalDependency = { module: temporalModuleRef } as const;
