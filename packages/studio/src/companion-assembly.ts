import { installDistributionPackageResolution } from "@qflow/qflow/loader/node";
import type { LoadedPackage } from "@qflow/qflow/loader";
import { studioContributionFromPackage } from "@qflow/studio-companion";

import { fallbackStudioTrackCompanions } from "./fallback-companions.js";
import { StudioCompanionRegistry } from "./studio-registry.js";

/**
 * Assemble the immutable Companion Registry for one Source closure.
 *
 * Every package actually selected by the Source may contribute its own Companion through the
 * same package host-facet boundary. There is no second project profile, central Companion list or
 * replacement table.
 */
export async function loadStudioCompanionRegistry(input: {
  readonly distributionPackageRoot: string;
  readonly sourcePackages: readonly LoadedPackage[];
}): Promise<StudioCompanionRegistry> {
  installDistributionPackageResolution([input.distributionPackageRoot]);
  const selected = new Map<string, LoadedPackage>();
  for (const item of input.sourcePackages) {
    if (!selected.has(item.specifier)) selected.set(item.specifier, item);
  }
  const contributions = [...selected.values()].map((item) =>
    studioContributionFromPackage(item.specifier, item.contribution.facets ?? []));
  return new StudioCompanionRegistry(
    [...fallbackStudioTrackCompanions, ...contributions.flatMap((item) => item.tracks)],
    {
      films: contributions.flatMap((item) => item.films),
      temporalDomains: contributions.flatMap((item) => item.temporalDomains),
      parameters: contributions.flatMap((item) => item.parameters),
    },
  );
}
