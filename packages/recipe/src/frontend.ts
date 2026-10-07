import {
  sealRecord,
} from "@qflow/kernel";
import type { AuthorFrontend, AuthorSourceExport } from "@qflow/author";
import { decodeSourceText } from "@qflow/source";

import { recipeFrontendId, recipeModuleRef, recipeType } from "./manifest.js";
import { parseRecipe } from "./parser.js";

export const recipeFrontend: AuthorFrontend = {
  id: recipeFrontendId,
  discover() {
    return { modules: [`${recipeModuleRef.name}@${recipeModuleRef.version}`], sources: [] };
  },
  decode(source, context) {
    const parsed = parseRecipe(source.name, decodeSourceText(source));
    const records = parsed.recipes.map((recipe) => sealRecord({
      id: recipe.value.path,
      type: recipeType,
      value: { kind: "inline", value: recipe.value },
    }));
    const exports: AuthorSourceExport[] = records.map((record) => ({
      name: record.id,
      ref: { kind: "record", id: record.id },
      type: record.type,
    }));
    return {
      records,
      components: [],
      fragments: [],
      exports,
    };
  },
};
