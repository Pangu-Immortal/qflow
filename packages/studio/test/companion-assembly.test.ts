import assert from "node:assert/strict";
import test from "node:test";

import { compositionTypes } from "@qflow/composition";
import { createStudioTrackCompanionFacet } from "@qflow/studio-companion";
import { loadNodePackageSelection } from "@qflow/qflow/loader/node";
import { temporalProducers } from "@qflow/temporal";

import { loadStudioCompanionRegistry } from "../src/companion-assembly.js";

test("a Source-selected package contributes its Companion without a second Studio profile", async () => {
  const module = { name: "@project/cards", version: "1" } as const;
  const registry = await loadStudioCompanionRegistry({
    distributionPackageRoot: process.cwd(),
    sourcePackages: [{
      specifier: "@project/cards",
      contribution: {
        format: "qflow.package@1",
        facets: [createStudioTrackCompanionFacet([{
          id: "cards",
          role: "track",
          family: "cards",
          output: { type: compositionTypes.visualTrack, surface: "track", modules: [module] },
        }])],
      },
    }],
  });
  assert.equal(
    registry.trackCompanionFor(compositionTypes.visualTrack, { surface: "track", module }, [])?.id,
    "@project/cards#cards",
  );
});

test("Temporal supplies its inverse relations only when the Source selects the package", async () => {
  const distributionPackageRoot = process.cwd();
  const empty = await loadStudioCompanionRegistry({ distributionPackageRoot, sourcePackages: [] });
  assert.equal(empty.temporalRelationFor(temporalProducers.composeWindow, "window"), undefined);
  const sourcePackages = await loadNodePackageSelection(["@qflow/temporal"], distributionPackageRoot);
  const registry = await loadStudioCompanionRegistry({ distributionPackageRoot, sourcePackages });
  assert.ok(registry.temporalRelationFor(temporalProducers.composeWindow, "window"));
});
