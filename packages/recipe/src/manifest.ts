import type { ModuleManifest, TypeRef } from "@qflow/protocol";

export const recipeModuleRef = { name: "@qflow/recipe", version: "1" } as const;
export const recipeType = { module: recipeModuleRef, name: "Recipe" } satisfies TypeRef;
export const recipeFrontendId = "@qflow/recipe@1";

export const recipeManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: recipeModuleRef.name,
  version: recipeModuleRef.version,
  dependencies: [],
  types: [{
    name: recipeType.name,
  }],
  capabilities: [],
  producers: [],
};
