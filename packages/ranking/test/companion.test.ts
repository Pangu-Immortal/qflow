import assert from "node:assert/strict";
import test from "node:test";
import { compositionTypes } from "@qflow/qflow/composition";
import type { StudioTrackCompanionContext } from "@qflow/studio-companion";
import { rankingStudioTrackCompanions } from "../src/studio.js";

test("each Ranking surface has independent visual and audio Companions", () => {
  for (const surface of ["column", "tier", "top-three"]) {
    const companions = rankingStudioTrackCompanions.filter((entry) => entry.output.surface === surface);
    assert.equal(companions.length, 2);
    const audio = companions.find((entry) => entry.output.type.name === compositionTypes.audioTrack.name)!;
    const visual = companions.find((entry) => entry.output.type.name === compositionTypes.visualTrack.name)!;
    assert.equal(audio.label, "Ranking Sounds");
    assert.ok(audio.inspector?.some((field) => field.binding === "style.appear-gain" && field.number?.scale === 100));
    assert.ok(visual.inspector?.every((field) => !field.binding.includes("gain") && !field.binding.includes("sound-fade")));
  }
});

test("audio uses exact event identities and emitted clips, with shared recipe ownership", () => {
  const audio = rankingStudioTrackCompanions.find((entry) => entry.id === "tier-audio")!;
  const context = {
    track: { outputRef: "board.audio", value: { clips: [
      { id: "opaque-event-id", artifact: { resource: "res_sound" } },
    ] }, trace: { outputPorts: [{ name: "events", ref: "board.events" }] } },
    placement: { id: "board", range: { start: 0, end: 100 }, children: [
      { id: "player", attributes: { label: "Player One" }, values: [] },
    ] },
    values: new Map([["board.events", { events: [
      { id: "opaque-event-id", itemId: "player", kind: "move", frame: 90 },
      { id: "unprovided-sound", itemId: "player", kind: "appear", frame: 0 },
    ] }]]),
    spans: [{ id: "opaque-event-id", startFrame: 90, endFrameExclusive: 99, stackOrder: 0 }],
  } as unknown as StudioTrackCompanionContext;
  const items = audio.project!(context);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.display.title, "Player One · Move");
  assert.equal(items[0]!.authoredId, "board");
  assert.deepEqual(items[0]!.elementRange, context.placement!.range);
  assert.equal(items[0]!.temporal, undefined);
  assert.equal(items[0]!.inspector![0]!.value, "Player One · Move · 90f");
  assert.deepEqual([items[0]!.startFrame, items[0]!.endFrameExclusive], [90, 99]);
});
