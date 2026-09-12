import assert from "node:assert/strict";
import test from "node:test";

import type { MarkupAttributeValue, StructuredElement, SurfaceResolvedReference } from "@qflow/markup";
import { narrativeTypes } from "@qflow/narrative";
import { programSpaceTypes } from "@qflow/program-space";
import { timelineTypes } from "@qflow/timeline";
import type { TemporalInstantSpec } from "@qflow/temporal";

import { createTemporalInstantProjection, createTemporalWindowProjection, resolveTemporalContext } from "../src/index.js";

const range = { source: "main.svml", start: 0, end: 1 };
const reference = (path: string): MarkupAttributeValue => ({ kind: "reference", path });
const resolved = (path: string, type: SurfaceResolvedReference["type"]): SurfaceResolvedReference => ({
  path, type, ref: { kind: "record", id: path },
});

const timeline = resolved("timeline", timelineTypes.track);
const references = new Map([
  ["selection", resolved("selection", narrativeTypes.selection)],
  ["segment", resolved("segment", narrativeTypes.excerpt)],
  ["moment", resolved("moment", narrativeTypes.moment)],
]);
const resolveReference = (path: string) => references.get(path);
const element = (attributes: Record<string, MarkupAttributeValue>): StructuredElement => ({
  kind: "element", name: "example:Item", attributes, children: [], range,
});
const specs = (projection: ReturnType<typeof createTemporalWindowProjection>) => projection.records
  .filter((record) => record.type.name === "TemporalInstantSpec")
  .map((record) => record.value.kind === "inline" ? record.value.value as unknown as TemporalInstantSpec : undefined);

test("the author bridge owns the four Window forms and the explicit Instant fallback", () => {
  assert.deepEqual(specs(createTemporalWindowProjection({
    id: "during", element: element({ during: reference("selection") }), timeline, resolveReference,
  })).map((spec) => spec?.authority), [
    { kind: "semantic", boundary: "start" },
    { kind: "semantic", boundary: "end" },
  ]);

  assert.deepEqual(specs(createTemporalWindowProjection({
    id: "at", element: element({ at: reference("moment"), for: "8f" }), timeline, resolveReference,
  })).map((spec) => spec?.authority), [
    { kind: "semantic", boundary: "cue" },
    { kind: "parameter", binding: "for", relation: "after-start" },
  ]);

  assert.deepEqual(specs(createTemporalWindowProjection({
    id: "until", element: element({ until: reference("moment"), for: "8f" }), timeline, resolveReference,
  })).map((spec) => spec?.authority), [
    { kind: "parameter", binding: "for", relation: "before-end" },
    { kind: "semantic", boundary: "cue" },
  ]);

  assert.deepEqual(specs(createTemporalWindowProjection({
    id: "explicit",
    element: element({ start: "moment.cue+3f", end: "program.end", moment: reference("moment") }),
    timeline, resolveReference,
  })).map((spec) => spec?.authority), [
    { kind: "parameter", binding: "start", relation: "direct" },
    { kind: "parameter", binding: "end", relation: "direct" },
  ]);

  const instant = createTemporalInstantProjection({
    id: "fallback", element: element({ instant: "moment.cue+3f", moment: reference("moment") }),
    timeline, resolveReference,
  });
  assert.deepEqual(specs(instant as ReturnType<typeof createTemporalWindowProjection>)[0]?.authority,
    { kind: "parameter", binding: "instant", relation: "direct" });
  assert.throws(() => createTemporalInstantProjection({
    id: "ambiguous", element: element({ at: "moment.cue+3f" }), timeline, resolveReference,
  }), /exact duration/u);
});

test("authored time and Script events use the same Timeline with different projections", () => {
  const space = resolved("animation", programSpaceTypes.programSpace);
  const at = createTemporalInstantProjection({ id: "message", element: element({ at: "2.5s" }), timeline, resolveReference });
  const absolute = specs(at as ReturnType<typeof createTemporalWindowProjection>)[0]!;
  assert.deepEqual(absolute.projection, { ref: "absolute", at: { unit: "seconds", numerator: 5, denominator: 2 } });
  assert.deepEqual(absolute.authority, { kind: "parameter", binding: "at", relation: "direct" });
  assert.equal(at.fragments.at(-1)!.inputs.some(input => input.name === "timeline"), true);
  assert.deepEqual(at.components.at(-1)!.inputs.timeline, timeline.ref);

  const window = specs(createTemporalWindowProjection({
    id: "bubble", element: element({ at: "2.5s", for: "8f" }), timeline, resolveReference,
  }));
  assert.deepEqual(window[1]?.projection, { ref: "absolute", at: { unit: "seconds", numerator: 5, denominator: 2 }, offset: { unit: "frames", value: 8 } });
  const bound = createTemporalInstantProjection({ id: "message", element: element({ at: reference("moment") }), timeline, resolveReference });
  assert.equal(bound.fragments.at(-1)!.inputs.some(input => input.name === "timeline"), true);
  assert.deepEqual(bound.components.at(-1)!.inputs.timeline, timeline.ref);

  const context = resolveTemporalContext({ element: element({ timeline: reference("timeline") }), resolveReference: path => path === "timeline" ? timeline : undefined });
  assert.deepEqual(context, { timeline });
  assert.throws(() => resolveTemporalContext({
    element: element({ timeline: reference("animation") }), resolveReference: () => space,
  }), /must reference a Timeline/);
});


test("bare references and explicit offsets expose the same local parameter edit", () => {
  for (const instant of ["moment.cue", "moment.cue + 0f", "moment.cue - 2f", "20f"]) {
    const projection = createTemporalInstantProjection({
      id: "event", element: element({ instant: instant!, ...(instant!.startsWith("moment") ? { moment: reference("moment") } : {}) }),
      timeline, resolveReference,
    });
    assert.deepEqual(specs(projection)[0]!.authority, { kind: "parameter", binding: "instant", relation: "direct" });
  }
});

test("Window endpoints can bind distinct Segments without reversing a Script Selection", () => {
  const before = resolved("before", narrativeTypes.excerpt), after = resolved("after", narrativeTypes.excerpt);
  const projection = createTemporalWindowProjection({ id: "overlap", timeline,
    element: element({ start: "segment.start", "start-source": reference("after"), end: "segment.end", "end-source": reference("before") }),
    resolveReference: path => path === "before" ? before : path === "after" ? after : undefined,
  });
  assert.deepEqual(projection.components[0]!.inputs["start-segment"], after.ref);
  assert.deepEqual(projection.components[0]!.inputs["end-segment"], before.ref);
  assert.deepEqual(specs(projection).map(spec => spec?.authority), [
    { kind: "parameter", binding: "start", relation: "direct" }, { kind: "parameter", binding: "end", relation: "direct" },
  ]);
});
