import assert from "node:assert/strict";
import test from "node:test";

import type { BuildState, ProducerStep, TypeRef, TypedRecord } from "@qflow/protocol";

import { executedTemporalBindings } from "../src/temporal-graph.js";

const module = (name: string) => ({ name, version: "1" });
const type = (owner: string, name: string): TypeRef => ({ module: module(owner), name });
const record = (id: string, owner: string, name: string, value: unknown): TypedRecord => ({
  id, type: type(owner, name), value: { kind: "inline", value: value as never },
});
const producer = (owner: string, name: string) => ({ module: module(owner), name });
const step = (id: string, owner: string, name: string, inputs: ProducerStep["inputs"], outputs: ProducerStep["outputs"]): ProducerStep => ({
  id, producer: producer(owner, name), inputs, outputs, needs: {},
});

test("Studio reads Point lineage from the executed projection and consumption edges", () => {
  const program = [
    record("semantic", "@qflow/semantic-track", "SemanticTrack", { id: "speech" }),
    record("moment", "@qflow/narrative", "NarrativeMoment", { id: "cue", anchorId: "cue-anchor" }),
    record("point-spec", "@qflow/temporal", "TemporalPointSpec", { id: "deck.card", projection: { ref: "moment.cue" } }),
    record("card-spec", "@qflow/deck-track", "DepthStackCardSpec", { id: "card" }),
  ];
  const executed = [
    record("point", "@qflow/temporal", "TemporalPoint", {
      id: "deck.card::cue", source: { kind: "moment", id: "cue" }, projection: { ref: "moment.cue" }, frame: 42,
    }),
    record("cards", "@qflow/deck-track", "DepthStackCardSet", { cards: [{ id: "card", activationFrame: 42 }] }),
    record("track", "@qflow/composition", "VisualTrack", { presents: [] }),
    record("unused-point", "@qflow/temporal", "TemporalPoint", {
      id: "unused::cue", source: { kind: "moment", id: "cue" }, projection: { ref: "moment.cue" }, frame: 7,
    }),
  ];
  const steps = [
    step("project", "@qflow/temporal", "project-moment-point", { semantic: "semantic", moment: "moment", spec: "point-spec" }, { point: "point" }),
    step("append", "@qflow/deck-track", "append-depth-stack-card", { set: "empty", spec: "card-spec", activation: "point" }, { set: "cards" }),
    step("render", "@qflow/deck-track", "render-depth-stack", { program: "cards" }, { track: "track" }),
  ];
  const state = {
    format: "qflow.build@1",
    program: { closure: { modules: [] }, records: program },
    graph: { format: "qflow.graph@1", outputs: [], candidates: [], operations: [] },
    request: { format: "qflow.build-request@1", targets: [{ output: "visual" }] },
    plan: {
      format: "qflow.plan@1", steps, goals: [{ record: "track", type: type("@qflow/composition", "VisualTrack") }],
      selections: [{ output: "visual", candidate: "visual-candidate", record: "track" }],
    },
    status: "complete", records: executed, steps: steps.map(({ id }) => ({ id, status: "complete" as const })),
    needs: [], outstanding: [], diagnostics: [],
  } as unknown as BuildState;

  const bindings = executedTemporalBindings(state, "visual");
  assert.equal(bindings.length, 1);
  assert.deepEqual(bindings[0], {
    record: "point",
    specRecord: "point-spec",
    specId: "deck.card",
    id: "deck.card::cue",
    source: { kind: "moment", id: "cue" },
    projection: { kind: "point", expression: "moment.cue", frame: 42 },
    consumers: [{
      step: "append",
      producer: producer("@qflow/deck-track", "append-depth-stack-card"),
      input: "activation",
      inputs: [
        { name: "activation", record: "point", type: type("@qflow/temporal", "TemporalPoint"), value: executed[0]!.value.kind === "inline" ? executed[0]!.value.value : undefined },
        { name: "spec", record: "card-spec", type: type("@qflow/deck-track", "DepthStackCardSpec"), value: { id: "card" } },
      ],
    }],
  });
});
