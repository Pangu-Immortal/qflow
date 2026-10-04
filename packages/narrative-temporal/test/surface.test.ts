import assert from "node:assert/strict";
import test from "node:test";

import { parseStructuredElement, type SurfaceResolvedReference } from "@qflow/markup";
import { narrativeTypes } from "@qflow/narrative";
import { decodeNarrativeProjectionSurface, narrativeProjectionMarkupSurface, narrativeTemporalTypes } from "@qflow/narrative-temporal";
import { temporalTypes } from "@qflow/temporal";
import { timelineTypes } from "@qflow/timeline";

test("Projection Surface balances maps and publishes only requested absolute values", async () => {
  const source = `<semantic:Projection id="story-time" narrative={story} timeline={film}>
    <semantic:Map alignment={one.alignment} domain={one.domain} window={one.window}/>
    <semantic:Map alignment={two.alignment} domain={two.domain} window={two.window}/>
    <semantic:Map alignment={three.alignment} domain={three.domain} window={three.window}/>
    <semantic:Window id="proof" selection={proof}/>
    <semantic:Instant id="reveal" moment={reveal}/>
    <semantic:Instant id="ending" segment={ending} boundary="end" offset="-12f"/>
  </semantic:Projection>`;
  const typed = (path: string, type: SurfaceResolvedReference["type"]): SurfaceResolvedReference =>
    ({ path, type, ref: { kind: "record", id: path } });
  const references = new Map<string, SurfaceResolvedReference>([
    ["story", typed("story", narrativeTypes.narrative)],
    ["film", typed("film", timelineTypes.track)],
    ["proof", typed("proof", narrativeTypes.selection)],
    ["reveal", typed("reveal", narrativeTypes.moment)],
    ["ending", typed("ending", narrativeTypes.excerpt)],
    ...["one", "two", "three"].flatMap((id): Array<[string, SurfaceResolvedReference]> => [
      [`${id}.alignment`, typed(`${id}.alignment`, narrativeTemporalTypes.narrativeAlignment)],
      [`${id}.domain`, typed(`${id}.domain`, temporalTypes.localDomain)],
      [`${id}.window`, typed(`${id}.window`, temporalTypes.window)],
    ]),
  ]);
  const output = await decodeNarrativeProjectionSurface({
    sourceName: "projection.svml",
    element: parseStructuredElement({ name: "projection.svml", text: source }, 0).element,
    resolveReference: (path) => references.get(path),
    resolveAsset: async () => { throw new Error("unused"); },
  });
  assert.deepEqual(output.exports, ["story-time.projection", "story-time.proof", "story-time.proof.start",
    "story-time.proof.end", "story-time.reveal", "story-time.ending"]);
  const fragment = output.fragments[0]!;
  assert.equal(fragment.operations.filter((operation) => operation.producer.name === "project-narrative-alignment").length, 3);
  assert.equal(fragment.operations.filter((operation) => operation.producer.name === "combine-narrative-projection-parts").length, 2);
  assert.equal(fragment.operations.at(-1)?.producer.name, "finalize-narrative-projection");
  assert.equal(output.fragments.some((candidate) => candidate.operations.some((operation) => operation.producer.name === "compose-window")), true);
  assert.equal(output.records.some((record) => record.type.name === "NarrativeInstantSpec"
    && record.value.kind === "inline" && JSON.stringify(record.value.value).includes('"value":-12')), true);
});

test("Projection Surface declares every private Record Type it emits", () => {
  const outputNames = new Set(narrativeProjectionMarkupSurface.outputs.map((type) => type.name));
  assert.ok(outputNames.has("NarrativeProjectionHeader"));
  assert.ok(outputNames.has("NarrativeInstantSpec"));
  assert.ok(outputNames.has("TemporalWindowSpec"));
});
