import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserProgram } from "@qflow/qflow/hyperframes";
import type { FontStackRef } from "@qflow/media";
import type { ProgramSpace } from "@qflow/program-space";
import { composeTemporalWindow, projectMomentInstant, projectProgramInstant } from "@qflow/temporal";
import { timelineFixture } from "../../../../../test/timeline-fixture.js";
import { fixtureResource } from "../../../../../test/fixture-resource.js";
import { renderChat } from "../src/render.js";

const space: ProgramSpace = { id: "animation", durationSec: 8, frameRate: { numerator: 30, denominator: 1 } };
const font: FontStackRef = { faces: [{ sources: [{ artifact: { kind: "blob", resource: fixtureResource("chat-font"), size: 32, mediaType: "font/woff2" } }], weight: 600, style: "normal" }] };
const point = (id: string, frame: number) => projectProgramInstant({ itemId: id, subjectId: id, timeline: { ...space, items: [] },
  projection: { ref: "absolute", at: { unit: "frames", value: frame } }, authority: { kind: "fixed" } });
const window = composeTemporalWindow({ id: "chat", subjectId: "chat" }, point("chat", 0), point("chat", 240));

test("the same chat renderer consumes authored and word-bound events; changing performance moves only the word-bound message", () => {
  const scene = (wordFrame: number) => {
    const semantic = timelineFixture(space, { anchors: [{ identity: "answer", frame: wordFrame }] });
    const at = projectMomentInstant({ itemId: "reply", subjectId: "reply", timeline: semantic,
      moment: { narrativeId: semantic.narrativeId, id: "answer", anchorId: "answer" },
      projection: { ref: "moment.cue" }, authority: { kind: "semantic", boundary: "cue" } });
    return renderChat(semantic, { widthPx: 540, heightPx: 960, origin: "top-left", xDirection: "right", yDirection: "down", pixelAspect: "square" }, window, font, [
      { id: "opening", sender: "Maya", text: "Ready?", side: "left", at: point("opening", 15) },
      { id: "reply", sender: "Leo", text: "Ready.", side: "right", at },
    ], { id: "chat", title: "Launch", entranceFrames: 10 });
  };
  const program = (value: ReturnType<typeof scene>) => {
    const element = value.presents[0]!.elements.find(element => element.kind === "program")!;
    assert.equal(element.kind, "program");
    return element.program.payload as unknown as BrowserProgram;
  };
  const before = program(scene(60)), after = program(scene(90));
  assert.equal(before.html, after.html);
  assert.deepEqual(before.data, { times: [15, 60], entrance: 10 });
  assert.deepEqual(after.data, { times: [15, 90], entrance: 10 });
});
