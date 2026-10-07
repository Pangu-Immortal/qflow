import assert from "node:assert/strict";
import test from "node:test";
import { compositionTypes } from "@qflow/composition";
import { audioTrackTypes } from "@qflow/audio-track";
import { visualTrackTypes } from "@qflow/visual-track";
import type { StudioTrackCompanionContext } from "@qflow/studio-companion";
import { audioTrackStudioTrackCompanions } from "../../audio-track/src/studio.js";
import { visualTrackStudioTrackCompanions } from "../../visual-track/src/studio.js";

for (const kind of ["audio", "visual"] as const) {
  test(`${kind} Clip titles use explicit author names or exact source references without changing identity`, () => {
    const sourceType = kind === "audio" ? audioTrackTypes.clipSpec : visualTrackTypes.clipSpec;
    const subjects = ["my-chosen-name", "track.item.0002", "track.item.0003"];
    const child = (id: string, index: number) => ({
      ...(index === 0 ? { id } : {}),
      attributes: index === 0 ? { id } : {},
      referenceAttributes: { [kind === "audio" ? "source" : "image"]: "assets.shared.material" },
      range: { start: index * 10, end: index * 10 + 9 },
      values: [{ type: sourceType, value: { id } }],
    });
    const clips = subjects.map((id, index) => ({
        id: `projected.${index}`, subjectId: id,
        window: { startFrame: index * 10, endFrameExclusive: index * 10 + 20 },
        span: { startFrame: index * 10, endFrameExclusive: index * 10 + 20 },
        order: index, z: index,
        source: { artifact: { resource: "res_audio" } },
        layers: [{ kind: "sample", id: "picture", source: { kind: "still", artifact: { resource: "res_image" } } }],
      }));
    const program = { id: `track.${kind}`, clips };
    const context = {
      track: { outputRef: `track.${kind}`, typeRef: kind === "audio" ? compositionTypes.audioTrack : compositionTypes.visualTrack,
        trace: { outputPorts: [{ name: "program", ref: "track.program" }] } },
      placement: { children: subjects.map(child) },
      values: new Map([["track.program", program]]), spans: [], temporalBindings: [],
    } as unknown as StudioTrackCompanionContext;
    const companion = kind === "audio" ? audioTrackStudioTrackCompanions[0]!
      : visualTrackStudioTrackCompanions.find((entry) => entry.id === "visual")!;
    const entities = companion.project!(context);
    assert.deepEqual(entities.map((entry) => entry.display.title), ["my-chosen-name", "assets.shared.material", "assets.shared.material"]);
    assert.deepEqual(entities.map((entry) => entry.authoredId), subjects);
    assert.equal(new Set(entities.map((entry) => entry.id)).size, 3);
    assert.deepEqual(entities.map((entry) => entry.elementRange), subjects.map(child).map((entry) => entry.range));
    assert.deepEqual(entities.map((entry) => [entry.startFrame, entry.endFrameExclusive]), [[0, 20], [10, 30], [20, 40]]);
  });
}

test("audio source time stays explicit and gain remains a bounded mixing control", () => {
  const companion = audioTrackStudioTrackCompanions[0]!;
  const sourceTime = companion.bindings!.find(binding => binding.name === "source-time")!;
  assert.equal(sourceTime.writable, undefined);
  assert.equal(companion.inspector!.some(field => field.binding === sourceTime.name), false);
  const gain = companion.inspector!.find(field => field.binding === "gain")!;
  assert.equal(gain.domain, "how"); assert.equal(gain.number?.scale, 100); assert.equal(gain.number?.maximum, 6400);
});
