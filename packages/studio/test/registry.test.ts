import assert from "node:assert/strict";
import test from "node:test";

import { compositionTypes } from "@qflow/composition";
import type { StudioTrackCompanion } from "@qflow/studio-companion";

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

test("Inspector objects stay out of the Timeline while child Tracks remain available", () => {
  const companion: StudioTrackCompanion = {
    id: "cards", role: "track", family: "cards", tone: "blue",
    output: { type: compositionTypes.visualTrack },
    inspectorObjects: [{
      id: "rules", label: "Presentation Rules",
      bindings: [{ name: "style" }],
      inspector: [{ binding: "style", label: "Style", domain: "how", section: { id: "style", label: "Style" }, control: "text" }],
      project: () => [{ id: "rule", authoredId: "rule", title: "Layout" }],
    }],
    attachments: [{ id: "objects", family: "objects", icon: "layers", facet: "visual", lane: { heightPx: 40 } }],
    project: () => [{ id: "card", authoredId: "card",
      display: { title: "Card", layers: [] }, startFrame: 0, endFrameExclusive: 120, stackOrder: 0 }],
  };
  const registry = new StudioCompanionRegistry([companion]);
  const track = { typeRef: compositionTypes.visualTrack, outputRef: "cards.visual", name: "cards", type: "VisualTrack",
    candidateOrigin: "source", role: "track", value: {}, trace: { references: [], outputPorts: [] } } as const;
  assert.deepEqual(registry.trackAttachments(track).map(item => item.attachmentId), ["objects"]);
  const context = { track, values: new Map(), spans: [], temporalBindings: [], temporalDomains: [], generic: () => [] };
  const [draft] = registry.projectTrack(context);
  assert.equal(draft?.display.title, "Card");
  const [rule] = registry.projectInspectorObjects(context);
  assert.equal(rule?.label, "Presentation Rules");
  assert.deepEqual(rule?.bindings, [{ name: "style" }]);
  assert.equal(rule?.inspector[0]?.label, "Style");
  assert.equal(rule?.draft.title, "Layout");
  const invalid = new StudioCompanionRegistry([{ ...companion,
    inspectorObjects: [{ ...companion.inspectorObjects![0]!, project: () => [rule!.draft, rule!.draft] }],
  }]);
  assert.throws(() => invalid.projectInspectorObjects(context), /repeats Inspector object/);
});
