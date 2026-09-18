import assert from "node:assert/strict";
import test from "node:test";
import { hyperframesHtmlAssetUrls, mapHyperframesHtmlUrls } from "../src/index.js";

test("materialized HTML preserves CSS attribute quoting and internal SVG references while relocating media", () => {
  const html = '<style>@font-face{src:url("./font.woff2")}</style><div style="background-image:url(&quot;./picture.png&quot;);filter:url(#mask)">'
    + '<img src="./picture.png"><a href="https://example.org">link</a></div>';
  assert.deepEqual(hyperframesHtmlAssetUrls(html), ["./font.woff2", "./picture.png"]);
  const mapped = mapHyperframesHtmlUrls(html, url => url.startsWith("./") ? `./assets/${url.slice(2)}` : url);
  assert.match(mapped, /background-image:url\(&quot;\.\/assets\/picture.png&quot;\)/u);
  assert.match(mapped, /filter:url\(&quot;#mask&quot;\)/u);
  assert.match(mapped, /src="\.\/assets\/picture.png"/u);
  assert.match(mapped, /href="https:\/\/example.org"/u);
});
