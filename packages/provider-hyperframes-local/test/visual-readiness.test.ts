import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import type { CaptureSession } from "@hyperframes/engine";
import { MemoryResourceStore } from "@qflow/driver-node";
import { sealComposition, sealVisualTrack } from "@qflow/composition";
import type { VisualElement, VisualTextTypography } from "@qflow/composition";
import { compileHyperframesDocument, materializeHyperframesHtml } from "@qflow/hyperframes";
import { sealTimeline } from "@qflow/timeline";
import { browserExecutablePath } from "../src/browser.js";
import { createOpaqueFrameCapture } from "../src/opaque-capture.js";
import { renderHyperframesFrames } from "../src/render.js";

const live = { skip: process.env.QFLOW_BROWSER_TESTS !== "1" };

test("capture waits for dynamic images and rejects broken images or exact fonts", live, async (t) => {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ff0000" } }).png().toBuffer();
  const blue = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#0000ff" } }).png().toBuffer();
  const server = createServer((request, response) => {
    setTimeout(() => {
      response.setHeader("Content-Type", "image/png");
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.end(request.url?.includes("blue") ? blue : png);
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
    await t.test("stable pages are discovered once and later inline resource changes stay local", async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 64, height: 64 });
        await page.setContent(`<style>body{margin:0}</style><div id="target" style="width:64px;height:64px;background:#000"></div>${"<span></span>".repeat(200)}`);
        await page.evaluate(origin => {
          const original = window.getComputedStyle.bind(window);
          const state = window as unknown as { __styleReads: number; __hf: unknown };
          state.__styleReads = 0;
          Object.defineProperty(window, "getComputedStyle", { configurable: true, value(...args: Parameters<typeof getComputedStyle>) {
            state.__styleReads += 1;
            return original(...args);
          } });
          state.__hf = { async seek(time: number) {
            if (time >= 1 / 30) document.getElementById("target")!.style.opacity = "0.999";
            if (time >= 2 / 30) document.getElementById("target")!.style.backgroundImage = `url(${origin}/local.png)`;
          } };
        }, origin);
        const capture = await createOpaqueFrameCapture({ page,
          options: { fps: { num: 30, den: 1 }, width: 64, height: 64 } } as unknown as CaptureSession);
        await capture(0);
        const initialReads = await page.evaluate(() => (window as unknown as { __styleReads: number }).__styleReads);
        assert.ok(initialReads >= 600, "the initial pass should discover the complete existing document");
        await capture(1);
        assert.equal(await page.evaluate(() => (window as unknown as { __styleReads: number }).__styleReads), initialReads,
          "an unchanged frame must not rescan computed styles");
        const frame = await capture(2);
        const finalReads = await page.evaluate(() => (window as unknown as { __styleReads: number }).__styleReads);
        assert.ok(finalReads - initialReads <= 6, `one changed element unexpectedly caused ${finalReads - initialReads} style reads`);
        const { data, info } = await sharp(frame.buffer).raw().toBuffer({ resolveWithObject: true });
        const center = (32 * info.width + 32) * info.channels;
        assert.deepEqual([...data.subarray(center, center + 3)], [255, 0, 0]);
      } finally { await page.close(); }
    });
    await t.test("a page-owned capture scope limits initial opaque resource discovery", async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 64, height: 64 });
        await page.setContent(`<style>body{margin:0}</style><div id="selected" style="width:64px;height:64px;background:#000"></div><div id="unselected">${"<span></span>".repeat(200)}</div>`);
        await page.evaluate(origin => {
          const original = window.getComputedStyle.bind(window);
          const state = window as unknown as { __styleReads: number; __hf: unknown; __qflowCaptureRoots: readonly Element[] };
          state.__styleReads = 0;
          Object.defineProperty(window, "getComputedStyle", { configurable: true, value(...args: Parameters<typeof getComputedStyle>) {
            state.__styleReads += 1;
            return original(...args);
          } });
          const selected = document.getElementById("selected")!;
          state.__qflowCaptureRoots = [selected];
          state.__hf = { async seek(time: number) {
            if (time >= 1 / 30) selected.style.backgroundImage = `url(${origin}/scoped.png)`;
          } };
        }, origin);
        const capture = await createOpaqueFrameCapture({ page,
          options: { fps: { num: 30, den: 1 }, width: 64, height: 64 } } as unknown as CaptureSession);
        await capture(0);
        const initialReads = await page.evaluate(() => (window as unknown as { __styleReads: number }).__styleReads);
        assert.ok(initialReads <= 6, `one capture root unexpectedly caused ${initialReads} style reads`);
        const frame = await capture(1);
        const { data, info } = await sharp(frame.buffer).raw().toBuffer({ resolveWithObject: true });
        const center = (32 * info.width + 32) * info.channels;
        assert.deepEqual([...data.subarray(center, center + 3)], [255, 0, 0]);
      } finally { await page.close(); }
    });
    await t.test("native image-style animations remain frame-active without global discovery", async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 64, height: 64 });
        await page.setContent('<style>body{margin:0}</style><div id="target" style="width:64px;height:64px"></div>');
        await page.evaluate(origin => {
          const target = document.getElementById("target")!;
          const animation = target.animate([
            { backgroundImage: `url(${origin}/red.png)` },
            { backgroundImage: `url(${origin}/blue.png)` },
          ], { duration: 1_000, fill: "both" });
          animation.pause();
          (window as unknown as { __hf: unknown }).__hf = { async seek(time: number) { animation.currentTime = time * 1_000; } };
        }, origin);
        const capture = await createOpaqueFrameCapture({ page,
          options: { fps: { num: 30, den: 1 }, width: 64, height: 64 } } as unknown as CaptureSession);
        const first = await capture(0);
        const last = await capture(30);
        for (const [frame, expected] of [[first, [255, 0, 0]], [last, [0, 0, 255]]] as const) {
          const { data, info } = await sharp(frame.buffer).raw().toBuffer({ resolveWithObject: true });
          const center = (32 * info.width + 32) * info.channels;
          assert.deepEqual([...data.subarray(center, center + 3)], expected);
        }
      } finally { await page.close(); }
    });
    await t.test("an opaque CSSOM edit takes the explicit whole-page fallback", async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 64, height: 64 });
        await page.setContent('<style>body{margin:0}</style><div id="target" style="width:64px;height:64px"></div>');
        await page.evaluate(origin => {
          let changed = false;
          (window as unknown as { __hf: unknown }).__hf = { async seek(time: number) {
            if (!changed && time >= 1 / 30) {
              changed = true;
              document.styleSheets[0]!.insertRule(`#target{background-image:url(${origin}/cssom.png)}`);
            }
          } };
        }, origin);
        const capture = await createOpaqueFrameCapture({ page,
          options: { fps: { num: 30, den: 1 }, width: 64, height: 64 } } as unknown as CaptureSession);
        await capture(0);
        const frame = await capture(1);
        const { data, info } = await sharp(frame.buffer).raw().toBuffer({ resolveWithObject: true });
        const center = (32 * info.width + 32) * info.channels;
        assert.deepEqual([...data.subarray(center, center + 3)], [255, 0, 0]);
      } finally { await page.close(); }
    });
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("compiled frame selection neither stages nor waits for unrelated image resources", live, async () => {
  const resources = new MemoryResourceStore();
  const unavailable = { kind: "blob" as const, resource: "res_unavailable-unselected-image" as const,
    size: 123, mediaType: "image/png" };
  const broken = await resources.put(new TextEncoder().encode("not an image"), "image/png");
  const red = await resources.put(await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ff0000" } })
    .png().toBuffer(), "image/png");
  const space = sealTimeline({ id: "capture-scope", frameCount: 60, frameRate: { numerator: 30, denominator: 1 } });
  const track = sealVisualTrack({ id: "visual", timelineId: space.id, visualIr: "qflow.visual-ir@1", presents: [
    { id: "unavailable-early", order: 0, z: 0, span: { startFrame: 0, endFrameExclusive: 10 },
      elements: [{ id: "unavailable", order: 0, kind: "image", artifact: unavailable,
        style: [{ name: "width", value: "64px" }, { name: "height", value: "64px" }] }] },
    { id: "broken-early", order: 1, z: 1, span: { startFrame: 10, endFrameExclusive: 30 },
      elements: [{ id: "broken", order: 0, kind: "image", artifact: broken,
        style: [{ name: "width", value: "64px" }, { name: "height", value: "64px" }] }] },
    { id: "red-late", order: 2, z: 2, span: { startFrame: 30, endFrameExclusive: 60 },
      elements: [{ id: "red", order: 0, kind: "image", artifact: red,
        style: [{ name: "width", value: "64px" }, { name: "height", value: "64px" }] }] },
  ] });
  const document = compileHyperframesDocument(sealComposition({ id: "capture-scope",
    canvas: { width: 64, height: 64, clearColor: "#000000" }, tracks: [track] }), space);

  const [artifact] = await renderHyperframesFrames({ document, frames: [45] },
    { resources, workers: 1, processTimeoutMs: 120_000 });
  const pixels = await sharp((await resources.get(artifact!.resource))!).removeAlpha().raw().toBuffer();
  const center = (32 * 64 + 32) * 3;
  assert.deepEqual([...pixels.subarray(center, center + 3)], [255, 0, 0]);
  await assert.rejects(renderHyperframesFrames({ document, frames: [15] },
    { resources, workers: 1, processTimeoutMs: 120_000 }), /image could not be decoded/u);
});

test("real capture keeps later Present animation local with picture content and independent workers", live, async () => {
  const resources = new MemoryResourceStore();
  const black = await resources.put(await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#000000" },
  }).png().toBuffer(), "image/png");
  const timeline = sealTimeline({ id: "local-animation", frameCount: 90, frameRate: { numerator: 30, denominator: 1 } });
  const picture = sealVisualTrack({ id: "picture", timelineId: timeline.id, visualIr: "qflow.visual-ir@1", presents: [{
    id: "picture", order: 0, z: 0, span: { startFrame: 0, endFrameExclusive: 90 },
    elements: [{ id: "picture", order: 0, kind: "image", artifact: black,
      style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 },
        { name: "width", value: "64px" }, { name: "height", value: "64px" }] }],
  }] });
  const animated = sealVisualTrack({ id: "animated", timelineId: timeline.id, visualIr: "qflow.visual-ir@1",
    presents: [0, 30, 60].map((startFrame, order) => ({
      id: `pose-${order + 1}`, order, z: 1, span: { startFrame, endFrameExclusive: startFrame + 30 },
      elements: [{ id: "pose", order: 0, kind: "box", style: [
        { name: "position", value: "absolute" }, { name: "inset", value: 0 }, { name: "background", value: "#ffffff" },
      ], animation: { keyframes: [
        { atFrame: 0, style: [{ name: "opacity", value: 0 }] },
        { atFrame: 30, style: [{ name: "opacity", value: 1 }] },
      ] } }],
    })),
  });
  const document = compileHyperframesDocument(sealComposition({ id: "local-animation", canvas: {
    width: 64, height: 64, clearColor: "#000000",
  }, tracks: [picture, animated] }), timeline);
  const frames = await renderHyperframesFrames({ document, frames: [15, 45, 75] }, {
    resources, workers: 2, processTimeoutMs: 120_000,
  });
  for (const [index, artifact] of frames.entries()) {
    const pixels = await sharp((await resources.get(artifact.resource))!).removeAlpha().raw().toBuffer();
    const center = (32 * 64 + 32) * 3;
    const sample = [...pixels.subarray(center, center + 3)];
    for (const channel of sample) assert.ok(Math.abs(channel - 128) <= 3,
      `frame ${[15, 45, 75][index]} used a non-local animation pose: ${JSON.stringify(sample)}`);
  }
});

test("terminal text and SVG mask sources retain their Present frame animations across direct seeks and fresh workers", live, async () => {
  const space = sealTimeline({ id: "animations", frameCount: 60, frameRate: { numerator: 30, denominator: 1 } });
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
  const sequences = [{ id: "letters-in", unit: "grapheme" as const, range: { start: 0, endExclusive: 1 }, order: "forward" as const,
    startFrame: 0, unitDurationFrames: 30, staggerFrames: 0, cycles: 1,
    keyframes: [{ atProgress: 0, style: [{ name: "opacity", value: 0 }] },
      { atProgress: 1, style: [{ name: "opacity", value: 1 }] }] },
  { id: "letters-out", unit: "grapheme" as const, range: { start: 0, endExclusive: 1 }, order: "forward" as const,
    startFrame: 0, unitDurationFrames: 30, staggerFrames: 0, cycles: 1,
    keyframes: [{ atProgress: 0, style: [{ name: "opacity", value: 1 }] },
      { atProgress: 1, style: [{ name: "opacity", value: 0 }] }] }];
  const text = { style: [], animation, document: { paragraphs: [{ id: "p", inlines: [{ kind: "text" as const, id: "t", text: "A" }] }] },
    typography, paints: [{ kind: "fill" as const, paint: { kind: "solid" as const, color: "#ffffff" } }], sequences };
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
  const track = sealVisualTrack({ id: "visual", timelineId: space.id, visualIr: "qflow.visual-ir@1",
    presents: [{ id: "later", order: 0, z: 0, span: { startFrame: 15, endFrameExclusive: 60 }, elements }] });
  const compiled = compileHyperframesDocument(sealComposition({ id: "animation", canvas: { width: 128, height: 128, clearColor: "#000000" }, tracks: [track] }), space);
  const html = materializeHyperframesHtml(compiled, artifact => artifact.resource === "res_font"
    ? "data:font/woff2;base64,AA==" : "data:image/png;base64,AA==");
  const browser = await puppeteer.launch({ executablePath: browserExecutablePath({}), headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    // Glyph appearance is irrelevant to this element-opacity test; the tiny invalid font
    // settles immediately. Font loading and painted text have separate integration coverage.
    await page.setContent(html);
    const valuesAt = async (target: typeof page, frame: number) => await target.evaluate(async frame => {
      const waits: Promise<void>[] = [];
      window.dispatchEvent(new CustomEvent("hf-seek", { detail: {
        time: frame / 30,
        waitUntil(value: Promise<void>) { waits.push(value); },
      } }));
      await Promise.all(waits);
      const timelines = (window as typeof window & { __timelines?: Record<string, { totalTime(time: number): void }> }).__timelines;
      timelines?.animation?.totalTime(frame / 30);
      const roots = ["flow", "path", "mask-image"].map(id => Number(getComputedStyle(document.querySelector(`[data-qflow-element-id="${id}"]`)!).opacity));
      const units = ["flow", "path"].map(id => Number(getComputedStyle(document.querySelector(`[data-qflow-element-id="${id}"] [data-qflow-text-unit-grapheme="0"]`)!).opacity));
      return { roots, units };
    }, frame);
    for (const frame of [30, 45, 15, 40, 30]) {
      const values = await valuesAt(page, frame);
      for (const value of values.roots) assert.ok(Math.abs(value - (frame - 15) / 30) < 0.001,
        `frame ${frame}: ${JSON.stringify(values)}`);
      for (const value of values.units) assert.ok(Math.abs(value - (1 - (frame - 15) / 30)) < 0.001,
        `frame ${frame}: ${JSON.stringify(values)}`);
    }
    for (const frame of [15, 30, 45]) {
      const fresh = await browser.newPage();
      try {
        await fresh.setContent(html);
        const values = await valuesAt(fresh, frame);
        for (const value of values.roots) assert.ok(Math.abs(value - (frame - 15) / 30) < 0.001,
          `fresh worker frame ${frame}: ${JSON.stringify(values)}`);
        for (const value of values.units) assert.ok(Math.abs(value - (1 - (frame - 15) / 30)) < 0.001,
          `fresh worker frame ${frame}: ${JSON.stringify(values)}`);
      } finally { await fresh.close(); }
    }
  } finally { await browser.close(); }
});
