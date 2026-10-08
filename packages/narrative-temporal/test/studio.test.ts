import assert from "node:assert/strict";
import test from "node:test";

import type { StudioPlacement } from "@qflow/studio-companion";

import { narrativeTemporalModuleRef } from "../src/manifest.js";
import { narrativeStudioTemporalDeclarations } from "../src/studio.js";

const placement = (surface: string, port: string): StudioPlacement => ({
  tag: `semantic:${surface}`,
  module: narrativeTemporalModuleRef,
  sourcePath: "main.svml",
  surface,
  id: "claim",
  range: { start: 4, end: 24 },
  records: [], values: [], outputs: ["claim"], outputPorts: [{ name: port, ref: "claim" }],
  children: [], attributes: {}, attributeValueRanges: {}, referenceAttributes: {}, referenceTypes: {}, references: [],
});

test("Narrative temporal companions expose semantic Window and Instant as the same declaration shape", () => {
  const window = narrativeStudioTemporalDeclarations.find((item) => item.match.surface === "narrative-window")!;
  const instant = narrativeStudioTemporalDeclarations.find((item) => item.match.surface === "narrative-instant")!;
  assert.deepEqual(window.project({ placement: placement("Window", "window") }),
    [{ id: "claim", label: "claim", output: "claim", range: { start: 4, end: 24 } }]);
  assert.deepEqual(instant.project({ placement: placement("Instant", "instant") }),
    [{ id: "claim", label: "claim", output: "claim", range: { start: 4, end: 24 } }]);
});
