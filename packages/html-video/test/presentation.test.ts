import assert from "node:assert/strict";
import test from "node:test";
import { htmlProgramComponent } from "@qflow/html-program";

test("render requests describe their own frame range and canvas without exposing HTML", () => {
  const present = htmlProgramComponent.plannedNeeds[0]!.present;
  const program = {
    canvas: { width: 1080, height: 1920 }, frameRate: { numerator: 30000, denominator: 1001 },
    frameCount: 600, html: "large HTML belongs to execution", artifacts: [], surfaces: [], frameSources: [],
  };
  assert.deepEqual(present({ constraints: {}, pendingInputs: [] }), { fields: {}, references: {} });
  const whole = present({ constraints: { program }, pendingInputs: [] });
  assert.deepEqual(whole.fields, {
    width: [1080], height: [1920], startFrame: [0], endFrameExclusive: [600], frameRate: ["30000/1001"],
  });
  const range = present({ constraints: { program, range: { startFrame: 30, endFrameExclusive: 91 } }, pendingInputs: [] });
  assert.equal(range.fields.startFrame?.[0], 30);
  assert.equal(range.fields.endFrameExclusive?.[0], 91);
  assert.equal("html" in range.fields, false);
});
