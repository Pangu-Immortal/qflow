import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import type { CaptureSession } from "@hyperframes/engine";
import { sealComposition, sealVisualTrack } from "@qflow/composition";
import type { VisualElement, VisualTextTypography } from "@qflow/composition";
import { compileHyperframesDocument, materializeHyperframesHtml } from "@qflow/hyperframes";
import { sealProgramSpace } from "@qflow/program-space";
import { browserExecutablePath } from "../src/browser.js";
import { createOpaqueFrameCapture } from "../src/opaque-capture.js";

const live = { skip: process.env.QFLOW_BROWSER_TESTS !== "1" };

test("capture waits for dynamic images and rejects broken images or exact fonts", live, async (t) => {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ff0000" } }).png().toBuffer();
  const server = createServer((_request, response) => {
    setTimeout(() => {
      response.setHeader("Content-Type", "image/png");
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.end(png);
    }, 300);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await puppeteer.launch({ executablePath: browserExecutablePath({}), headless: true, args: ["--no-sandbox"] });
  try {
    for (const kind of ["class", "pseudo", "mask", "svg", "broken", "font"] as const) await t.test(kind, async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 64, height: 64 });
        const css = kind === "mask" ? `.paint{background:red;mask-image:url(${origin}/mask.png)}`
          : kind === "font" ? '@font-face{font-family:broken;src:url(data:font/woff2;base64,AA==)}body{font-family:broken}' : kind === "pseudo"
          ? `.paint::before{content:'';position:absolute;inset:0;background-image:url(${origin}/pseudo.png)}`
          : `.paint{background-image:url(${origin}/class.png)}`;
        const html = kind === "font" ? '<span>A</span>' : kind === "svg" ? '<svg width="64" height="64"><image id="target" width="64" height="64"/></svg>'
          : kind === "broken" ? '<img src="data:image/png;base64,YmFk"/>'
          : '<div id="target" style="width:64px;height:64px"></div>';
        await page.setContent(`<style>body{margin:0}${css}</style>${html}`);
        if (kind === "broken") await page.waitForFunction(() => document.images[0]!.complete);
        await page.evaluate(({ kind, origin }) => {
          (window as unknown as { __hf: unknown }).__hf = { async seek() {
            const target = document.getElementById("target");
            if (kind === "svg") target!.setAttribute("href", `${origin}/svg.png`);
            else if (target !== null) target.classList.add("paint");
          } };
        }, { kind, origin });
        const capture = await createOpaqueFrameCapture({ page,
          options: { fps: { num: 30, den: 1 }, width: 64, height: 64 } } as unknown as CaptureSession);
        if (kind === "broken") await assert.rejects(capture(0), /image could not be decoded/u);
        else if (kind === "font") await assert.rejects(capture(0), /font could not be loaded/u);
        else {
          const frame = await capture(0);
          const { data, info } = await sharp(frame.buffer).raw().toBuffer({ resolveWithObject: true });
          const center = (32 * info.width + 32) * info.channels;
          assert.deepEqual([...data.subarray(center, center + 3)], [255, 0, 0]);
        }
      } finally { await page.close(); }
    });
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("terminal text and SVG mask sources retain their Present frame animations on direct seeks", live, async () => {
  const space = sealProgramSpace({ id: "animations", durationSec: 2, frameRate: { numerator: 30, denominator: 1 } });
  const image = { kind: "blob", resource: "res_mask", size: 1, mediaType: "image/png" } as const;
  const font = { sources: [{ artifact: { kind: "blob", resource: "res_font", size: 1, mediaType: "font/woff2" } }],
    weight: 400, style: "normal" } as const;
  const typography: VisualTextTypography = { fonts: [font], sizePx: 20, weight: 400, style: "normal", axes: [], features: [],
    synthesis: "none", kerning: "auto", trackingPx: 0, wordSpacingPx: 0, lineHeight: 1, direction: "auto",
    writingMode: "horizontal-tb", baselineShiftPx: 0, tabSize: 4, indentationPx: 0, paragraphBeforePx: 0,
    paragraphAfterPx: 0, transform: "none", variantCaps: "normal", verticalAlign: "baseline", decorations: [],
    cjk: { textSpacing: "normal", punctuationTrim: "none" } };
  const animation = { keyframes: [{ atFrame: 0, style: [{ name: "opacity", value: 0 }] },
    { atFrame: 30, style: [{ name: "opacity", value: 1 }] }] };
  const text = { style: [], animation, document: { paragraphs: [{ id: "p", inlines: [{ kind: "text" as const, id: "t", text: "A" }] }] },
    typography, paints: [{ kind: "fill" as const, paint: { kind: "solid" as const, color: "#ffffff" } }], sequences: [] };
  const elements: VisualElement[] = [
    { id: "root", kind: "box", order: 0, style: [] },
    { ...text, id: "flow", parent: "root", order: 1, kind: "text-flow", flow: {
      form: { kind: "area" }, inlineSize: "hug", blockSize: "hug", paddingPx: { inlineStart: 0, inlineEnd: 0, blockStart: 0, blockEnd: 0 },
      inlineAlign: "start", blockAlign: "start", wrap: "none", overflow: "visible", clipToFrame: false, columns: 1,
      columnGapPx: 0, metricEdge: "line-box" } },
    { ...text, id: "path", parent: "root", order: 2, kind: "path-text",
      path: [{ kind: "move", x: 0, y: 20 }, { kind: "line", x: 100, y: 20 }], side: "left", orientation: "follow",
      align: "start", overflow: "visible", startMarginPx: 0, endMarginPx: 0, reverse: false },
    { id: "mask", parent: "root", order: 3, kind: "mask", mode: "alpha", maskElement: "mask-image", contentElement: "content",
      style: [{ name: "width", value: "64px" }, { name: "height", value: "64px" }] },
    { id: "mask-image", parent: "mask", order: 4, kind: "image", artifact: image, style: [], animation },
    { id: "content", parent: "mask", order: 5, kind: "box", style: [{ name: "background", value: "#ffffff" }] },
  ];
  const track = sealVisualTrack({ id: "visual", programSpaceId: space.id, visualIr: "qflow.visual-ir@1",
    presents: [{ id: "later", span: { startFrame: 15, endFrameExclusive: 60 }, stacking: { order: 0, tieBreak: "later" }, elements }] });
  const compiled = compileHyperframesDocument(sealComposition({ id: "animation", canvas: { width: 128, height: 128, clearColor: "#000000" }, tracks: [track] }), space);
  const browser = await puppeteer.launch({ executablePath: browserExecutablePath({}), headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    // Glyph appearance is irrelevant to this element-opacity test; the tiny invalid font
    // settles immediately. Font loading and painted text have separate integration coverage.
    await page.setContent(materializeHyperframesHtml(compiled, artifact => artifact.resource === "res_font"
      ? "data:font/woff2;base64,AA==" : "data:image/png;base64,AA=="));
    for (const frame of [30, 45, 15, 40, 30]) {
      const values = await page.evaluate(frame => {
        window.dispatchEvent(new CustomEvent("hf-seek", { detail: { time: frame / 30 } }));
        return ["flow", "path", "mask-image"].map(id => Number(getComputedStyle(document.querySelector(`[data-qflow-element-id="${id}"]`)!).opacity));
      }, frame);
      for (const value of values) assert.ok(Math.abs(value - (frame - 15) / 30) < 0.001, `frame ${frame}: ${values}`);
    }
  } finally { await browser.close(); }
});
