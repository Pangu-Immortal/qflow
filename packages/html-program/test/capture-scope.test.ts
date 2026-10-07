import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { parseHTML } from "linkedom";

import { presentationCaptureScopeRuntime } from "../src/capture-scope.js";
import { frameSelectionRuntime, htmlFrameSelectionPrelude } from "../src/frame-work.js";

test("compiled capture scope retains selected roots and makes unrelated media inert", () => {
  const { document } = parseHTML(`<!doctype html><body>
    <svg id="definitions" data-qflow-document-definitions></svg>
    <div id="early" data-qflow-present-start-frame="0" data-qflow-present-end-frame="30">
      <img id="early-image" data-qflow-resource-src="early.png" srcset="early-2x.png 2x"/>
      <video id="early-video" data-qflow-resource-src="early.mp4" poster="early.jpg"></video>
      <svg><image id="early-svg" data-qflow-resource-href="early.svg"/></svg>
    </div>
    <div id="selected" data-qflow-present-start-frame="90" data-qflow-present-end-frame="120">
      <img id="selected-image" data-qflow-resource-src="selected.png"/>
      <svg><image id="selected-svg" data-qflow-resource-href="selected.svg"/></svg>
    </div>
  </body>`);
  const early = document.getElementById("early")!;
  const earlyImage = document.getElementById("early-image")!;
  const earlyVideo = document.getElementById("early-video")!;
  const earlySvg = document.getElementById("early-svg")!;
  const context: { document: Document; __qflowCaptureRoots?: readonly Element[] } = { document };
  runInNewContext(`${htmlFrameSelectionPrelude([{ startFrame: 100, endFrameExclusive: 101 }])}
    ${frameSelectionRuntime}\n${presentationCaptureScopeRuntime}`, context);

  assert.deepEqual(JSON.parse(JSON.stringify(context.__qflowCaptureRoots?.map(root => root.id))), ["definitions", "selected"]);
  assert.equal(early.style.getPropertyValue("display"), "none");
  assert.equal(early.isConnected, false);
  assert.equal(document.getElementById("early"), null);
  for (const element of [earlyImage, earlyVideo, earlySvg]) {
    assert.equal(element.hasAttribute("src"), false);
    assert.equal(element.hasAttribute("href"), false);
  }
  assert.equal(earlyImage.hasAttribute("srcset"), false);
  assert.equal(earlyVideo.hasAttribute("poster"), false);
  assert.equal(document.getElementById("selected-image")!.getAttribute("src"), "selected.png");
  assert.equal(document.getElementById("selected-image")!.hasAttribute("data-qflow-resource-src"), false);
  assert.equal(document.getElementById("selected-svg")!.getAttribute("href"), "selected.svg");
  assert.equal(document.getElementById("selected-svg")!.hasAttribute("data-qflow-resource-href"), false);
});

test("compiled capture scope removes unselected Present descendants from generic live-DOM discovery", () => {
  const { document } = parseHTML(`<!doctype html><body>
    <div id="selected" data-qflow-present-start-frame="0" data-qflow-present-end-frame="30"><span></span></div>
    <div id="unselected" data-qflow-present-start-frame="30" data-qflow-present-end-frame="60">
      ${"<span><i></i></span>".repeat(200)}
    </div>
  </body>`);
  const before = document.querySelectorAll("*").length;
  const context: { document: Document; __qflowCaptureRoots?: readonly Element[] } = { document };
  runInNewContext(`${htmlFrameSelectionPrelude([{ startFrame: 0, endFrameExclusive: 1 }])}
    ${frameSelectionRuntime}\n${presentationCaptureScopeRuntime}`, context);

  assert.ok(before >= 400);
  assert.equal(document.getElementById("unselected"), null);
  assert.deepEqual(JSON.parse(JSON.stringify(context.__qflowCaptureRoots?.map(root => root.id))), ["selected"]);
  assert.ok(document.querySelectorAll("*").length <= 5);
});

test("compiled capture scope defaults to every Present outside a render selection", () => {
  const { document } = parseHTML(`<!doctype html><body>
    <div id="one" data-qflow-present-start-frame="0" data-qflow-present-end-frame="30"><img data-qflow-resource-src="one.png"/></div>
    <div id="two" data-qflow-present-start-frame="30" data-qflow-present-end-frame="60"><img data-qflow-resource-src="two.png"/></div>
  </body>`);
  const context: { document: Document; __qflowCaptureRoots?: readonly Element[] } = { document };
  runInNewContext(`${frameSelectionRuntime}\n${presentationCaptureScopeRuntime}`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.__qflowCaptureRoots?.map(root => root.id))), ["one", "two"]);
  assert.equal(document.querySelector("[data-qflow-capture-excluded]"), null);
  assert.deepEqual(Array.from(document.querySelectorAll("img")).map(image => image.getAttribute("src")), ["one.png", "two.png"]);
});
