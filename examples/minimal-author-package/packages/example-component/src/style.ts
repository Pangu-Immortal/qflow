import type { FontStackRef } from "@qflow/media";
import type { Recipe } from "@qflow/qflow/recipe";

/** The two values a Style decoder receives after author references are resolved. */
export type ExampleStyleInput = {
  readonly recipe: { readonly path: string; readonly properties: Recipe["properties"] };
  readonly fonts: FontStackRef;
};

/** A deliberately small, runnable Style boundary for the fixture. */
export function decodeExampleStyle(input: ExampleStyleInput): { readonly recipe: ExampleStyleInput["recipe"]; readonly fonts: FontStackRef } {
  return { recipe: { path: input.recipe.path, properties: { ...input.recipe.properties } }, fonts: input.fonts };
}
