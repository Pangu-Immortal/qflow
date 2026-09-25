import assert from "node:assert/strict";
import test from "node:test";
import { hyperframesHtmlAssetUrls, hyperframesHtmlDomain, mapHyperframesHtmlUrls } from "../src/index.js";

test("materialized composition HTML retains its exact frame domain", () => {
  const root = '<div data-composition-id="main" data-width="1080" data-height="1920" data-fps="30000/1001" data-qflow-frame-count="90">';
  assert.deepEqual(hyperframesHtmlDomain(`<style>.a{color:red}</style>${root}</div>`), {
    frameRate: { numerator: 30000, denominator: 1001 },
    frameCount: 90,
    canvas: { width: 1080, height: 1920 },
  });
  assert.throws(() => hyperframesHtmlDomain(`${root}</div>${root}</div>`), /exactly one compiled HyperFrames composition root/u);
});

test("materialized HTML preserves CSS attribute quoting and internal SVG references while relocating media", () => {
  const html = '<style>@font-face{src:url("./font.woff2")}</style><div style="background-image:url(&quot;./picture.png&quot;);filter:url(#mask)">'
    + '<img src="./picture.png"><img data-qflow-resource-src="./later.png">'
    + '<svg><image data-qflow-resource-href="./mask.png"/></svg><a href="https://example.org">link</a></div>';
  assert.deepEqual(hyperframesHtmlAssetUrls(html), ["./font.woff2", "./picture.png", "./later.png", "./mask.png"]);
  const mapped = mapHyperframesHtmlUrls(html, url => url.startsWith("./") ? `./assets/${url.slice(2)}` : url);
  assert.match(mapped, /background-image:url\(&quot;\.\/assets\/picture.png&quot;\)/u);
  assert.match(mapped, /filter:url\(&quot;#mask&quot;\)/u);
  assert.match(mapped, /src="\.\/assets\/picture.png"/u);
  assert.match(mapped, /data-qflow-resource-src="\.\/assets\/later.png"/u);
  assert.match(mapped, /data-qflow-resource-href="\.\/assets\/mask.png"/u);
  assert.match(mapped, /href="https:\/\/example.org"/u);
});
