import assert from "node:assert/strict";
import test from "node:test";

import { compositionTypes } from "@qflow/composition";
import type { StudioTrackCompanion } from "@qflow/studio-adapter";

import { StudioCompanionRegistry } from "../src/studio-registry.js";

test("Companion origin matching includes the exact module version", () => {
  const moduleV1 = { name: "@example/track", version: "1" } as const;
  const companion: StudioTrackCompanion = {
    id: "example", role: "track", family: "example",
    output: { type: compositionTypes.visualTrack, surface: "track", modules: [moduleV1] },
  };
  const registry = new StudioCompanionRegistry([companion]);
  assert.equal(registry.trackCompanionFor(compositionTypes.visualTrack, { surface: "track", module: moduleV1 }, []), companion);
  assert.equal(registry.trackCompanionFor(
    compositionTypes.visualTrack,
    { surface: "track", module: { ...moduleV1, version: "2" } },
    [],
  ), undefined);
});

test("internal bands keep entities in their Track and own their Inspector bindings", () => {
  const companion: StudioTrackCompanion = {
    id: "cards", role: "track", family: "cards", tone: "blue",
    output: { type: compositionTypes.visualTrack },
    bands: [{ id: "rules", placement: "after", heightPx: 15, display: "label",
      bindings: [{ name: "style" }],
      inspector: [{ binding: "style", label: "Style", domain: "how", section: { id: "style", label: "Style" }, control: "text" }],
    }],
    attachments: [{ id: "objects", family: "objects", icon: "layers", facet: "visual", lane: { heightPx: 40 } }],
    project: () => [{ id: "rule", authoredId: "rule", band: "rules",
      display: { title: "Layout", layers: [] }, startFrame: 0, endFrameExclusive: 120, stackOrder: 0 }],
  };
  const registry = new StudioCompanionRegistry([companion]);
  const track = { typeRef: compositionTypes.visualTrack, outputRef: "cards.visual", name: "cards", type: "VisualTrack",
    candidateOrigin: "source", role: "track", value: {}, trace: { references: [], outputPorts: [] } } as const;
  assert.deepEqual(registry.trackAttachments(track).map(item => item.attachmentId), ["objects"]);
  assert.deepEqual(registry.bindTrack(track).bands, [{ id: "rules", placement: "after", heightPx: 15, display: "label" }]);
  assert.deepEqual(registry.bindingDeclarations(track, undefined, undefined, "rules"), [{ name: "style" }]);
  assert.equal(registry.inspectorDeclarations(track, undefined, undefined, "rules")[0]?.label, "Style");
  const context = { track, values: new Map(), spans: [], temporalBindings: [], semantic: undefined, generic: () => [] };
  const [draft] = registry.projectTrack(context);
  assert.equal(draft?.lane, undefined);
  assert.equal(draft?.band, "rules");
  const invalid = new StudioCompanionRegistry([{ ...companion, project: () => [{ ...draft!, band: "missing" }] }]);
  assert.throws(() => invalid.projectTrack(context), /declared band/);
  const ambiguous = new StudioCompanionRegistry([{ ...companion, project: () => [{ ...draft!, lane: "objects" }] }]);
  assert.throws(() => ambiguous.projectTrack(context), /declared band/);
});
