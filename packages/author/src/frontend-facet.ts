import {
  createFrontendFacet,
  frontendsFromFacets,
} from "@qflow/facet";
import type {
  FrontendFacet,
  Facet,
} from "@qflow/facet";
import { sourceFrontendPackageAbi } from "@qflow/source";

import type { AuthorFrontend } from "./source.js";

export type AuthorFrontendFacet = FrontendFacet<"author", AuthorFrontend> & {
  readonly abi: typeof sourceFrontendPackageAbi;
};

export function createAuthorFrontendFacet(frontend: AuthorFrontend): AuthorFrontendFacet {
  return createFrontendFacet(sourceFrontendPackageAbi, "author", frontend) as AuthorFrontendFacet;
}

export function authorFrontendsFromFacets(facets: readonly Facet[]): readonly AuthorFrontend[] {
  return frontendsFromFacets<"author", AuthorFrontend>(sourceFrontendPackageAbi, "author", facets);
}

export function installAuthorFrontendFacets(
  facets: readonly Facet[],
  registry: { register(frontend: AuthorFrontend): void },
): void {
  for (const frontend of authorFrontendsFromFacets(facets)) registry.register(frontend);
}
