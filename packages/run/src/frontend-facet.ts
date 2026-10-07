import {
  createFrontendFacet,
  frontendsFromFacets,
} from "@qflow/facet";
import type {
  FrontendFacet,
  Facet,
} from "@qflow/facet";
import { sourceFrontendPackageAbi } from "@qflow/source";

import type { RunFrontend } from "./types.js";

export type RunFrontendFacet = FrontendFacet<"run", RunFrontend> & {
  readonly abi: typeof sourceFrontendPackageAbi;
};

export function createRunFrontendFacet(frontend: RunFrontend): RunFrontendFacet {
  return createFrontendFacet(sourceFrontendPackageAbi, "run", frontend) as RunFrontendFacet;
}

export function runFrontendsFromFacets(facets: readonly Facet[]): readonly RunFrontend[] {
  return frontendsFromFacets<"run", RunFrontend>(sourceFrontendPackageAbi, "run", facets);
}
