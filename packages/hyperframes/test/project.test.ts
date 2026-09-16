import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { compileHyperframesDocument } from "../src/document.js";
import { stageHyperframesProject } from "../src/project.js";
import { sealComposition, sealVisualTrack } from "@qflow/composition";
import { sealProgramSpace } from "@qflow/program-space";

test("typed Surface inspection borrows the completed streamed file used by capture", async () => {
  const surface = { artifact: { kind: "blob" as const, resource: "res_streamed-surface" as const,
    size: 6, mediaType: "image/png" }, width: 1, height: 1, colorSpace: "srgb" as const,
    alphaMode: "straight" as const, timing: { kind: "still" as const } };
  const space = sealProgramSpace({ id: "space", durationSec: 1,
    frameRate: { numerator: 30, denominator: 1 } });
  const track = sealVisualTrack({ id: "surface", visualIr: "qflow.visual-ir@1", programSpaceId: space.id,
    presents: [{ id: "surface", span: { startFrame: 0, endFrameExclusive: 30 }, stacking: { order: 0, tieBreak: "surface" },
      elements: [{ id: "surface", kind: "surface", surface, order: 0, style: [] }] }] });
  const document = compileHyperframesDocument(sealComposition({ id: "main",
    canvas: { width: 64, height: 64, clearColor: "#000000" }, tracks: [track] }), space);
  const directory = await mkdtemp(join(tmpdir(), "qflow-stage-surface-"));
  let inspected = false;
  let streamFinished = false;
  try {
    await stageHyperframesProject({ document, directory, read: async () => (async function* () {
      // Readers may reuse their chunk buffer after each write.
      const chunk = new Uint8Array([1, 2, 3]);
      yield chunk;
      chunk.set([4, 5, 6]);
      yield chunk;
      streamFinished = true;
    })(), validateSurface: async (value, path) => {
      assert.ok(streamFinished);
      assert.deepEqual(value, surface);
      assert.equal(path, join(directory, "artifacts", "asset-0.png"));
      assert.deepEqual([...await readFile(path)], [1, 2, 3, 4, 5, 6]);
      inspected = true;
    } });
    assert.ok(inspected);
    assert.deepEqual(await readdir(join(directory, "artifacts")), ["asset-0.png"]);
    assert.match(await readFile(join(directory, "index.html"), "utf8"), /\.\/artifacts\/asset-0\.png/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("staging cancels and joins sibling reads before exposing a failure", async () => {
  const space = sealProgramSpace({ id: "space", durationSec: 1,
    frameRate: { numerator: 30, denominator: 1 } });
  const track = sealVisualTrack({ id: "images", visualIr: "qflow.visual-ir@1", programSpaceId: space.id,
    presents: ["a", "b"].map((id, order) => ({ id, span: { startFrame: 0, endFrameExclusive: 30 }, stacking: { order, tieBreak: id },
      elements: [{ id, order: 0, kind: "image" as const, style: [],
        artifact: { kind: "blob" as const, resource: `res_${id}` as const, size: 1, mediaType: "image/png" } }],
    })) });
  const document = compileHyperframesDocument(sealComposition({ id: "main", canvas: { width: 64, height: 64, clearColor: "#000000" }, tracks: [track] }), space);
  const directory = await mkdtemp(join(tmpdir(), "qflow-stage-cancel-"));
  let active = 0;
  try {
    await assert.rejects(stageHyperframesProject({ document, directory, read: async (artifact, signal) => {
      active++;
      try {
        if (artifact.resource === "res_a") { await delay(10); throw new Error("source unavailable"); }
        await delay(60_000, undefined, { signal });
        return new Uint8Array([0]);
      } finally { active--; }
    } }), /source unavailable/u);
    assert.equal(active, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("staging gives opaque Resource identities portable local names and writes complete streams", async () => {
  const resource = `res_${"x".repeat(247)}:img` as const;
  const space = sealProgramSpace({ id: "space", durationSec: 1, frameRate: { numerator: 30, denominator: 1 } });
  const track = sealVisualTrack({ id: "image", visualIr: "qflow.visual-ir@1", programSpaceId: space.id,
    presents: [{ id: "image", span: { startFrame: 0, endFrameExclusive: 30 }, stacking: { order: 0, tieBreak: "image" },
      elements: [{ id: "image", kind: "image", order: 0, style: [],
        artifact: { kind: "blob", resource, size: 5, mediaType: "image/png" } }] }] });
  const document = compileHyperframesDocument(sealComposition({ id: "main", canvas: { width: 64, height: 64, clearColor: "#000000" }, tracks: [track] }), space);
  const directory = await mkdtemp(join(tmpdir(), "qflow-stage-identity-"));
  try {
    await stageHyperframesProject({ document, directory, read: async artifact => {
      assert.equal(artifact.resource, resource);
      return (async function* () { yield new Uint8Array([1, 2]); yield new Uint8Array([3, 4, 5]); })();
    } });
    const files = await readdir(join(directory, "artifacts"));
    assert.equal(files.length, 1);
    assert.match(files[0]!, /^[a-z0-9-]+\.png$/u);
    assert.deepEqual([...await readFile(join(directory, "artifacts", files[0]!))], [1, 2, 3, 4, 5]);
    const html = await readFile(join(directory, "index.html"), "utf8");
    assert.ok(html.includes(`./artifacts/${files[0]}`));
    assert.ok(document.html.includes(resource), "materialization does not rewrite the portable document");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
