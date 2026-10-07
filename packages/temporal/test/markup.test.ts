import assert from "node:assert/strict";
import test from "node:test";

import type { MarkupAttributeValue, StructuredElement, SurfaceResolvedReference } from "@qflow/markup";
import { temporalTypes } from "@qflow/temporal";
import { timelineTypes } from "@qflow/timeline";

import { createTemporalInstantConstruction, createTemporalWindowConstruction, resolveTemporalContext } from "../src/markup/index.js";

const range = { source: "main.svml", start: 0, end: 1 };
const reference = (path: string): MarkupAttributeValue => ({ kind: "reference", path });
const resolved = (path: string, type: SurfaceResolvedReference["type"]): SurfaceResolvedReference => ({
  path, type, ref: { kind: "record", id: path },
});
const timeline = resolved("timeline", timelineTypes.timeline);
const references = new Map([
  ["timeline", timeline],
  ["start-instant", resolved("start-instant", temporalTypes.instant)],
  ["end-instant", resolved("end-instant", temporalTypes.instant)],
  ["extent", resolved("extent", temporalTypes.extent)],
  ["window", resolved("window", temporalTypes.window)],
]);
const resolveReference = (path: string) => references.get(path);
const element = (attributes: Record<string, MarkupAttributeValue>): StructuredElement => ({
  kind: "element", name: "example:Item", attributes, children: [], range,
});
const inlineValues = (construction: ReturnType<typeof createTemporalWindowConstruction>, typeName: string) => construction.records
  .filter((record) => record.type.name === typeName)
  .map((record) => record.value.kind === "inline" ? record.value.value : undefined);

test("whole Timeline and absolute literals lower without any domain projector", () => {
  const whole = createTemporalWindowConstruction({ id: "whole", element: element({ during: "timeline" }), timeline, resolveReference });
  assert.deepEqual(inlineValues(whole, "TemporalInstantSpec"), [
    { id: "whole.start", subjectId: "whole", projection: { ref: "timeline.start" } },
    { id: "whole.end", subjectId: "whole", projection: { ref: "timeline.end" } },
  ]);
  assert.equal(whole.fragments[0]!.inputs.some((port) => port.type.module.name.includes("narrative")), false);

  const literal = createTemporalWindowConstruction({ id: "literal", element: element({ from: "2.5s", for: "8f" }), timeline, resolveReference });
  assert.deepEqual(inlineValues(literal, "TemporalDuration"), [{ unit: "frames", value: 8 }]);
  assert.deepEqual(inlineValues(literal, "TemporalInstantSpec"), [{
    id: "literal.start", subjectId: "literal",
    projection: { ref: "absolute", at: { unit: "seconds", numerator: 5, denominator: 2 } },
    author: { binding: "from", relation: "direct" },
  }]);
  assert.deepEqual(inlineValues(literal, "TemporalShiftSpec"), [{
    id: "literal.end", subjectId: "literal", direction: 1,
    author: { binding: "for", relation: "after-start" },
  }]);
  assert.equal(literal.fragments[0]!.operations.some((operation) => operation.producer.name === "shift-instant"), true);
});

test("resolved Instants compose a Window and an Extent shifts either boundary", () => {
  const between = createTemporalWindowConstruction({ id: "between",
    element: element({ from: reference("start-instant"), until: reference("end-instant") }), timeline, resolveReference });
  assert.deepEqual(between.components[0]!.inputs["start-instant"], references.get("start-instant")!.ref);
  assert.deepEqual(between.components[0]!.inputs["end-instant"], references.get("end-instant")!.ref);

  const after = createTemporalWindowConstruction({ id: "after",
    element: element({ from: reference("start-instant"), for: reference("extent") }), timeline, resolveReference });
  assert.deepEqual(after.components[0]!.inputs.extent, references.get("extent")!.ref);
  assert.deepEqual(inlineValues(after, "TemporalShiftSpec"), [
    { id: "after.end", subjectId: "after", direction: 1 },
  ]);
});

test("resolved Window and Instant references pass directly through", () => {
  const window = createTemporalWindowConstruction({ id: "use", element: element({ during: reference("window") }), timeline, resolveReference });
  assert.deepEqual(window, { records: [], components: [], fragments: [], ref: references.get("window")!.ref });
  const instant = createTemporalInstantConstruction({ id: "cue", element: element({ at: reference("start-instant") }), timeline, resolveReference });
  assert.deepEqual(instant, { records: [], components: [], fragments: [], ref: references.get("start-instant")!.ref });
});

test("Instant literals use common Timeline arithmetic", () => {
  const at = createTemporalInstantConstruction({ id: "message", element: element({ at: "2.5s" }), timeline, resolveReference });
  assert.deepEqual(inlineValues(at, "TemporalInstantSpec"), [
    { id: "message", subjectId: "message", projection: { ref: "absolute", at: { unit: "seconds", numerator: 5, denominator: 2 } },
      author: { binding: "at", relation: "direct" } },
  ]);
});

test("Temporal context resolves only the absolute Timeline", () => {
  assert.deepEqual(resolveTemporalContext({ element: element({ timeline: reference("timeline") }), resolveReference }), { timeline });
  const clock = resolved("clock", timelineTypes.clock);
  assert.throws(() => resolveTemporalContext({ element: element({ timeline: reference("clock") }), resolveReference: () => clock }), /must reference a Timeline/);
});
