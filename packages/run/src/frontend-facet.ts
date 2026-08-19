import {
  createFrontendHostFacet,
  frontendsFromHostFacets,
} from "@qflow/host";
import type {
  FrontendHostFacet,
  HostFacet,
} from "@qflow/host";
import { sourceFrontendPackageAbi } from "@qflow/source";

import type { RunFrontend } from "./types.js";

export type RunFrontendHostFacet = FrontendHostFacet<"run", RunFrontend> & {
  readonly abi: typeof sourceFrontendPackageAbi;
};

export function createRunFrontendHostFacet(frontend: RunFrontend): RunFrontendHostFacet {
  return createFrontendHostFacet(sourceFrontendPackageAbi, "run", frontend) as RunFrontendHostFacet;
}

export function runFrontendsFromHostFacets(facets: readonly HostFacet[]): readonly RunFrontend[] {
  return frontendsFromHostFacets<"run", RunFrontend>(sourceFrontendPackageAbi, "run", facets);
}
