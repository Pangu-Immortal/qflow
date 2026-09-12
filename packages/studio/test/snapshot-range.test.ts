import assert from "node:assert/strict";
import test from "node:test";
import { compositionTypes } from "@qflow/composition";
import { snapshot } from "../src/snapshot.js";
import type { Preview } from "../src/programme.js";
import { StudioCompanionRegistry } from "../src/studio-registry.js";
import { fallbackStudioTrackCompanions } from "../src/fallback-companions.js";

test("a pure-MG work keeps its declared extent even when an editor entity extends beyond it", () => {
  const built = { source: { observations: { placements: [], sourceMaps: [] } },
    tracks: [{ outputRef: "art.visual", name: "art.visual", typeRef: compositionTypes.visualTrack,
      trace: { outputPorts: [], references: [] }, candidateOrigin: "source", value: { presents: [{ id: "scene", span: { startFrame: 0, endFrameExclusive: 150 }, stacking: { order: 0 } }] } }],
    space: { id: "work", durationSec: 3, frameRate: { numerator: 30, denominator: 1 } },
    values: new Map(), temporalBindings: new Map(),
  } as unknown as Preview;
  const result = snapshot(new StudioCompanionRegistry(fallbackStudioTrackCompanions), built, {
    revision: 1, path: "main.svml", text: "", run: { path: "main.svrun", targets: [], satisfactions: [] },
    canvas: { width: 1080, height: 1920, clearColor: "#000000" }, frameRate: built.space.frameRate,
    preview: { kind: "hyperframes", srcdoc: "" }, workspaceRoot: "/project", sourceFiles: [], surfaces: {} as never,
  });
  assert.equal(result.space.frameCount, 90); assert.equal(result.space.durationSec, 3);
  assert.equal(result.tracks[0]!.clips[0]!.endFrameExclusive, 150);
  assert.equal(result.semantic, undefined);
  assert.equal("timing" in result.provenance, false);
});
