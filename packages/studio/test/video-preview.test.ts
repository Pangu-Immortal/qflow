import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { injectRuntimeShim } from "../src/preview/runtime-shim.js";

test("preview scrubs to the same source frame as rendering at fractional sample positions", async () => {
  const attrs: Record<string, string> = {
    "data-start": "0", "data-duration": "1", "data-media-start": String(1.75 / 30), "data-playback-rate": "0.5",
    "data-qflow-start-frame": "0", "data-qflow-end-frame": "30", "data-qflow-source-frame": "7/4",
    "data-qflow-source-rate": "1/2", "data-qflow-source-fps": "30/1",
  };
  const listeners = new Map<string, () => void>();
  let currentTime = 0;
  const video = { style: {}, readyState: 4, duration: 10, paused: true,
    getAttribute: (name: string) => attrs[name] ?? null, closest: () => null,
    get currentTime() { return currentTime; },
    set currentTime(value: number) { currentTime = value; queueMicrotask(() => listeners.get("seeked")?.()); },
    pause() {}, play() { return Promise.resolve(); },
    addEventListener(name: string, listener: () => void) { listeners.set(name, listener); },
    removeEventListener(name: string) { listeners.delete(name); },
  };
  const root = { style: {}, getAttribute: (name: string) => ({ "data-fps": "30", "data-composition-id": "test" })[name] ?? null };
  const window: Record<string, any> = { addEventListener() {}, dispatchEvent() {},
    __qflowFrameProgram: { async applyFrame() {} } };
  const html = injectRuntimeShim("").trim();
  vm.runInNewContext(html.slice("<script>".length, -"</script>".length), {
    window, document: { querySelector: () => root,
      querySelectorAll: (selector: string) => selector === ".qflow-visual-present video" ? [video] : [] },
    CustomEvent: class {},
  });
  await window.__qflowFrameReady;
  // Source positions are 1.75, 2.25, 2.75, 3.25. Each decoded frame owns [n,n+1).
  for (const [frame, sourceFrame] of [[0, 1], [1, 2], [2, 2], [3, 3], [0, 1]] as const) {
    await window.__qflowSeekFrame(frame);
    assert.equal(video.currentTime, (sourceFrame + 0.5) / 30, `preview frame ${frame}`);
  }
});

test("preview keeps a compact zero-rate sampling interval paused on its source frame", async () => {
  const attrs: Record<string, string> = {
    "data-start": "2", "data-duration": "10", "data-media-start": "0.1", "data-playback-rate": "1",
    "data-qflow-start-frame": "60", "data-qflow-end-frame": "360", "data-qflow-source-frame": "3/1",
    "data-qflow-source-rate": "0/1", "data-qflow-source-fps": "30/1",
  };
  const listeners = new Map<string, () => void>();
  let currentTime = 0;
  let pauses = 0;
  let plays = 0;
  const video = { style: {}, readyState: 4, duration: 10, paused: true,
    getAttribute: (name: string) => attrs[name] ?? null, closest: () => null,
    get currentTime() { return currentTime; },
    set currentTime(value: number) { currentTime = value; queueMicrotask(() => listeners.get("seeked")?.()); },
    pause() { pauses += 1; }, play() { plays += 1; return Promise.resolve(); },
    addEventListener(name: string, listener: () => void) { listeners.set(name, listener); },
    removeEventListener(name: string) { listeners.delete(name); },
  };
  const root = { style: {}, getAttribute: (name: string) => ({ "data-fps": "30", "data-composition-id": "test" })[name] ?? null };
  const window: Record<string, any> = { addEventListener() {}, dispatchEvent() {},
    __qflowFrameProgram: { async applyFrame() {} } };
  const html = injectRuntimeShim("").trim();
  vm.runInNewContext(html.slice("<script>".length, -"</script>".length), {
    window, document: { querySelector: () => root,
      querySelectorAll: (selector: string) => selector === ".qflow-visual-present video" ? [video] : [] },
    CustomEvent: class {},
  });
  await window.__qflowSeekFrame(60);
  await window.__qflowPlayFrame(211);
  await window.__qflowSeekFrame(359);
  assert.equal(currentTime, 3.5 / 30);
  assert.equal(plays, 0, "a held interval never hands its clock to native video playback");
  assert.ok(pauses >= 3);
});

test("preview evaluates reverse source time by absolute frame without assigning a negative browser rate", async () => {
  const attrs: Record<string, string> = {
    "data-start": "0", "data-duration": "1", "data-media-start": String(9.5 / 30), "data-playback-rate": "-1",
    "data-qflow-start-frame": "0", "data-qflow-end-frame": "10", "data-qflow-source-frame": "9/1",
    "data-qflow-source-rate": "-1/1", "data-qflow-source-fps": "30/1",
  };
  const listeners = new Map<string, () => void>();
  let currentTime = 0;
  let plays = 0;
  let assignedRate: number | undefined;
  const video = { style: {}, readyState: 4, duration: 10, paused: true,
    getAttribute: (name: string) => attrs[name] ?? null, closest: () => null,
    get currentTime() { return currentTime; },
    set currentTime(value: number) { currentTime = value; queueMicrotask(() => listeners.get("seeked")?.()); },
    set playbackRate(value: number) { assignedRate = value; },
    pause() {}, play() { plays += 1; return Promise.resolve(); },
    addEventListener(name: string, listener: () => void) { listeners.set(name, listener); },
    removeEventListener(name: string) { listeners.delete(name); },
  };
  const root = { style: {}, getAttribute: (name: string) => ({ "data-fps": "30", "data-composition-id": "test" })[name] ?? null };
  const window: Record<string, any> = { addEventListener() {}, dispatchEvent() {},
    __qflowFrameProgram: { async applyFrame() {} } };
  const html = injectRuntimeShim("").trim();
  vm.runInNewContext(html.slice("<script>".length, -"</script>".length), {
    window, document: { querySelector: () => root,
      querySelectorAll: (selector: string) => selector === ".qflow-visual-present video" ? [video] : [] },
    CustomEvent: class {},
  });
  await window.__qflowPlayFrame(3);
  assert.equal(currentTime, 6.5 / 30);
  assert.equal(assignedRate, undefined);
  assert.equal(plays, 0);
});
