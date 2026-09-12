import assert from "node:assert/strict";
import test from "node:test";
import { parseStructuredElement } from "@qflow/markup";
import { audioTrackModuleRef } from "@qflow/audio-track";
import type { StudioPlacement, StudioEntityDraft, StudioTrackCompanion } from "@qflow/studio-adapter";
import { audioTrackStudioTrackCompanions } from "../../audio-track-studio/src/index.js";
import { sourceBindingsForDraft, inspectorFieldsForBindings } from "../src/parameters.js";
import { serializeAttributeGroup, validateParameterValue } from "../src/parameter-values.js";

function fields(text: string, companion: Pick<StudioTrackCompanion, "bindings" | "inspector"> = audioTrackStudioTrackCompanions[0]!) {
  const element = parseStructuredElement({ name: "main.svml", text }, 0).element;
  const placement = { ...element, id: "music", tag: element.name, surface: "item", module: audioTrackModuleRef,
    sourcePath: "main.svml", references: [], referenceAttributes: {}, records: [], outputs: [], outputPorts: [], values: [], children: [],
  } as unknown as StudioPlacement;
  const draft: StudioEntityDraft = { id: "music", authoredId: "music", display: { title: "Music", layers: [] }, startFrame: 0, endFrameExclusive: 90, stackOrder: 0 };
  return inspectorFieldsForBindings(draft, sourceBindingsForDraft({ root: "/project", files: [{ path: "main.svml", text, language: "svml" }],
    placement, draft, declarations: companion.bindings! }), companion.inspector!);
}

test("a grouped mode edit adds and removes dependent attributes without changing other author facts", () => {
  let text = '<a:Item id="music" source={song.media} gain="0.4"/>';
  let field = fields(text).find(field => field.binding === "playback-settings")!;
  assert.deepEqual(field.value, { playback: "once" });
  const stretch = { playback: "stretch", "min-rate": 0.8, "max-rate": 1.2 };
  validateParameterValue(stretch, field.schema!, "Playback");
  assert.throws(() => validateParameterValue({ playback: "stretch" }, field.schema!, "Playback"));
  text = serializeAttributeGroup(field, stretch);
  field = fields(text).find(field => field.binding === "playback-settings")!;
  assert.deepEqual(field.value, stretch);
  text = serializeAttributeGroup(field, { playback: "loop" });
  assert.equal(text, '<a:Item playback="loop" id="music" source={song.media} gain="0.4"/>');
  for (let count = 0; count < 3; count++) {
    field = fields(text).find(field => field.binding === "playback-settings")!;
    text = serializeAttributeGroup(field, stretch);
    field = fields(text).find(field => field.binding === "playback-settings")!;
    text = serializeAttributeGroup(field, { playback: "loop" });
  }
  assert.equal(text, '<a:Item playback="loop" id="music" source={song.media} gain="0.4"/>');
});

test("ordinary Audio defaults have real first-edit endpoints", () => {
  const held = fields('<a:Item id="music" source={song.media}/>');
  assert.deepEqual(held.filter(field => ["gain", "fade-in", "fade-out"].includes(field.binding!)).map(field => [field.binding, field.value, field.edit?.source.prefix]),
    [["gain", 1, ' gain="'], ["fade-in", "0f", ' fade-in="'], ["fade-out", "0f", ' fade-out="']]);
});


test("record attributes decode declared booleans and preserve strings before a grouped write", () => {
  const companion: Pick<StudioTrackCompanion, "bindings" | "inspector"> = {
    bindings: [{ name: "layout", attributes: ["enabled", "columns", "align"], writable: true,
      schema: { kind: "object", fields: {
        enabled: { schema: { kind: "boolean" } },
        columns: { schema: { kind: "number", minimum: 1 } },
        align: { schema: { kind: "string", enum: ["left", "right"] } },
      } } }],
    inspector: [{ binding: "layout", label: "Layout", domain: "where",
      section: { id: "layout", label: "Layout" }, control: "record" }],
  };
  const field = fields('<custom:Item id="music" enabled="false" columns="2" align="left"/>', companion)[0]!;
  assert.deepEqual(field.value, { enabled: false, columns: 2, align: "left" });
  const next = { enabled: true, columns: 3, align: "right" };
  validateParameterValue(next, field.schema!, "Layout");
  assert.deepEqual(fields(serializeAttributeGroup(field, next), companion)[0]!.value, next);
});
