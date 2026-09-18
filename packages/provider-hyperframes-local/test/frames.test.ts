import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { sealComposition, sealVisualTrack } from "@qflow/composition";
import { sealProgramSpace } from "@qflow/program-space";
import { browserProgram, compileHyperframesDocument, hyperframesHtmlDomain } from "@qflow/hyperframes";
import { stageHyperframesProject } from "@qflow/hyperframes/project";
import { verifyHyperframesFramesRequest } from "@qflow/render-hyperframes";
import { MemoryResourceStore } from "@qflow/driver-node";
import { renderHyperframesFrames } from "../src/index.js";

function fixture() {
  const space = sealProgramSpace({ id: "space", durationSec: 1, frameRate: { numerator: 12, denominator: 1 } });
  return compileHyperframesDocument(sealComposition({ id: "frames", canvas: { width: 96, height: 64, clearColor: "#000000" },
    tracks: [sealVisualTrack({ id: "motion", programSpaceId: space.id, visualIr: "qflow.visual-ir@1", presents: [{ id: "reveal",
      span: { startFrame: 3, endFrameExclusive: 12 }, stacking: { order: 0, tieBreak: "reveal" }, elements: [{ id: "program", order: 0,
        kind: "program", style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 }],
        program: browserProgram({ html: '<div class="box"></div>', css: '.box{position:absolute;top:0;width:8px;height:64px;background:#ff0000}',
          setup: 'return frame => { root.querySelector(".box").style.left = `${frame * 8}px`; };' }),
      }] }] })] }), space);
}

test("frame selection validates original-frame bounds and exact HTML clock", () => {
  const document = fixture();
  verifyHyperframesFramesRequest({ document, frames: [0, 3, 11] });
  for (const frames of [[], [12], [3, 2], [1.5]]) assert.throws(() => verifyHyperframesFramesRequest({ document, frames }));
  assert.deepEqual(hyperframesHtmlDomain(document.html), { frameRate: document.frameRate, frameCount: 12, canvas: document.canvas });
});

test("snapshot captures original browser-program frames from document and staged HTML without video encoding", {
  skip: process.env.QFLOW_BROWSER_TESTS !== "1",
}, async () => {
  const resources = new MemoryResourceStore();
  const document = fixture();
  const directory = await mkdtemp(join(tmpdir(), "qflow-frames-proof-"));
  try {
    await stageHyperframesProject({ document, directory, read: async artifact => (await resources.get(artifact.resource))! });
    const html = await readFile(join(directory, "index.html"), "utf8");
    for (const input of [{ document }, { project: { html, assets: [] } }]) {
      const phases: string[] = [];
      const images = await renderHyperframesFrames({ ...input, frames: [0, 3, 4, 11] }, { resources, workers: 2,
        onProgress: event => { phases.push(event.phase); } });
      assert.equal(images.length, 4);
      assert.ok(!phases.includes("encoding"));
      for (const [index, expectedX] of [-1, 0, 8, 64].entries()) {
        const bytes = await resources.get(images[index]!.resource);
        const image = await sharp(bytes).removeAlpha().raw().toBuffer();
        const pixel = (x: number) => [...image.subarray(x * 3, x * 3 + 3)];
        assert.deepEqual(pixel(expectedX < 0 ? 0 : expectedX + 2), expectedX < 0 ? [0, 0, 0] : [255, 0, 0]);
        if (expectedX > 0) assert.deepEqual(pixel(0), [0, 0, 0]);
      }
    }
    await assert.rejects(renderHyperframesFrames({ document, frames: [3] }, { resources, workers: 1, maxRenderedBytes: 1 }), /PNG output exceeds/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
