import { routeCardsHtml } from "../../shared/route-cards.js";
import { palette, paletteCss } from "@explainer/visual-language";
import { road_styles } from "./styles.js";
import { road_animation } from "./animation.js";
import { scene } from "../../shared/scene.js";
const arrow = `<svg viewBox="0 0 90 105"><defs><linearGradient id="pointer-metal" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#b6d9ed"/><stop offset="1" stop-color="#53677d"/></linearGradient></defs><path d="M8 6L77 53L47 59L34 89L8 6Z" fill="url(#pointer-metal)" stroke="#f9feff" stroke-width="3"/><path d="M15 17L58 50L39 52L33 70Z" fill="#152c3d"/></svg>`;
const wave = (n = 72) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<i style="height:${10 + Math.abs(Math.sin(i * 1.53) * Math.cos(i * 0.41)) * 30}px"></i>`,
  ).join("");
const ruler = Array.from(
  { length: 21 },
  (_, i) => `<span>${String(i).padStart(2, "0")}</span>`,
).join("");
const codeLines = Array.from(
  { length: 40 },
  (_, i) =>
    `keyframe(${(i * 0.07).toFixed(2)}, { x: ${Math.round(Math.sin(i * 0.2) * 210)}, y: ${Math.round(Math.cos(i * 0.3) * 90)}, scale: ${(1 + i * 0.014).toFixed(3)}, easing: "bezier" });`,
).join("\n");
export function renderRoad(t, c, w, font, o, events, m) {
  const b = Object.fromEntries(events.map((e) => [e.name, e.at.frame - w.span.startFrame])),
    count = w.span.endFrameExclusive - w.span.startFrame;
  const entries = {
    page: { media: m.page, start: b.half, end: b.overview + 12 },
    sample: { media: m.sample, start: b.generated, end: count },
    pointerlogo: { image: m.codex },
    "icon-capcut": { image: m.capcut },
    "icon-premiere": { image: m.premiere },
    "icon-resolve": { image: m.resolve },
    "flying-logo": { image: m.logo },
  };
  // These are the actual shots already used in this film, collected as stills for the editor demonstration.
  const gallery = [
    m.portrait,
    m["thumb-a"],
    m["thumb-b"],
    m["thumb-c"],
    m["thumb-d"],
    m["thumb-e"],
    m["thumb-f"],
    m["thumb-g"],
  ];
  for (let i = 0; i < 4; i++) entries["library" + i] = { image: gallery[[2, 3, 4, 5][i]] };
  for (let i = 0; i < 8; i++) entries["asset" + i] = { image: gallery[i] };
  for (let i = 0; i < 5; i++) entries["strip" + i] = { image: gallery[[0, 2, 3, 4, 6][i]] };
  for (let i = 0; i < 3; i++) entries["canvas" + i] = { image: gallery[[0, 6, 3][i]] };
  for (let i = 0; i < 2; i++) entries["drag" + i] = { image: gallery[[6, 3][i]] };
  const folder = Array.from(
    { length: 8 },
    (_, i) =>
      `<div class="asset" data-i="${i}"><div>{{asset${i}}}</div><small>${["HOST", "RANKING", "PODCAST", "INTERVIEW", "ORIGINAL", "ORIGINAL", "WEBSITE", "CODE"][i]} ${String(i + 1).padStart(2, "0")}</small></div>`,
  ).join("");
  const strips = Array.from(
    { length: 5 },
    (_, i) =>
      `<div class="clip clip-${i}" style="left:${70 + i * 151}px;width:${i % 2 ? 125 : 145}px;top:${i % 2 ? 100 : 45}px"><div>{{strip${i}}}</div><b>${i % 2 ? "VIDEO" : "IMAGE"}</b></div>`,
  ).join("");
  const diamonds = Array.from(
    { length: 25 },
    (_, i) =>
      `<i class="diamond" data-i="${i}" style="left:${65 + (i / 24) ** 1.15 * 850}px;top:${i % 3 === 0 ? 78 : 146}px"></i>`,
  ).join("");
  const variants = `<div class="variant v0"><b>1<span>Qflow</span></b><b>2<span>Creator</span></b><b>3<span>Studio</span></b></div><div class="variant v1"><div class="podiums"><b>2</b><b>1</b><b>3</b></div><strong>Qflow</strong></div><div class="variant v2"><strong>ABC</strong><p>Make it <em>yours.</em></p></div>`;
  const html = `
<div class="technical"
  ><canvas class="field" width="135" height="240"></canvas><div class="weave"></div
  ><div class="horizon"></div
></div>
<div class="homepage">{{page}}</div>
<div class="road-heading"></div>
${routeCardsHtml}
<div class="demo">
  <div class="editor"
    ><div class="editor-bar"><i></i><i></i><i></i><b>main.svml</b><span>00:00:06:12</span></div
    ><div class="editor-top"
      ><div class="library"
        ><small>MEDIA</small
        ><div class="library-grid"
          ><i>{{library0}}</i><i>{{library1}}</i><i>{{library2}}</i><i>{{library3}}</i></div
        ><div class="library-wave"
          ><i style="height: 8px"></i><i style="height: 21px"></i><i style="height: 34px"></i
          ><i style="height: 19px"></i><i style="height: 32px"></i><i style="height: 17px"></i
          ><i style="height: 30px"></i><i style="height: 15px"></i><i style="height: 28px"></i
          ><i style="height: 13px"></i><i style="height: 26px"></i><i style="height: 11px"></i
          ><i style="height: 24px"></i><i style="height: 9px"></i><i style="height: 22px"></i
          ><i style="height: 35px"></i></div></div
      ><div class="preview"
        ><div class="preview-grid"></div><div class="picture p0">{{canvas0}}</div
        ><div class="picture p1">{{canvas1}}</div><div class="picture p2">{{canvas2}}</div
        ><svg class="failed-path" viewBox="0 0 550 250">
          <path
            d="M90 180Q270 10 480 100"
            fill="none"
            stroke="#e83f5f"
            stroke-width="4"
            stroke-dasharray="9 8"
          />
          <path d="M470 82L490 100L466 115" fill="none" stroke="#e83f5f" stroke-width="4" /></svg
        ><div class="preview-label">COMPOSITION</div></div
      ><div class="properties"
        ><small>TRANSFORM</small><p>X <i>540</i></p
        ><p>Y <i>960</i></p
        ><p>Scale <i>100%</i></p
        ><div class="control-stack"
          ><b><i></i></b><b><i></i></b><b><i></i></b></div
        ><div class="align-tools"><b>↤</b><b>↔</b><b>↦</b></div></div
      ></div
    ><div class="timeline"
      ><div class="ticks">${ruler}</div><div class="lane-lines"></div>${strips}<div
        class="audio"
        >${wave()}</div
      ><div class="caption-blocks"><i>剪辑软件</i><i>素材生成</i><i>画布与时间轴</i></div
      ><div class="playhead"></div><div class="keys">${diamonds}</div></div
    ><div class="editor-veil"></div
  ></div>
  <div class="brands"
    ><div class="brand capcut">{{icon-capcut}}</div
    ><div class="brand premiere">{{icon-premiere}}</div
    ><div class="brand resolve">{{icon-resolve}}</div><div class="brand-equality"></div
  ></div>
  <div class="folder"
    ><div class="folder-tab">ASSETS</div
    ><div class="folder-face"
      ><div class="folder-label"></div><div class="assets">${folder}</div></div
    ></div
  >
  <div class="drag-tile d0">{{drag0}}</div><div class="drag-tile d1">{{drag1}}</div>
  <div class="motion-examples"
    ><div class="number-example"
      ><b>Qflow <em>#1</em></b
      ><div class="pulse-ring"></div></div
    ><div class="image-example"
      ><div class="flying-logo">{{flying-logo}}</div
      ><div class="logo-burst" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div
  ></div>
  <div class="key-label"></div>
  <div class="terminal-cost"
    ><div class="terminal-top"><i></i><i></i><i></i><span>motion.js</span></div
    ><pre></pre><div class="token-meter"><small>TOKENS</small><b>0</b><span>↑</span></div></div
  >
  <div class="generated"
    ><div class="sample">{{sample}}</div><div class="sample-label"></div
    ><svg class="connectors" viewBox="0 0 1020 650">
      <path d="M465 245L375 140L240 110" />
      <path d="M555 270L680 225L810 225" />
      <path d="M465 410L370 530L210 530" /></svg
    >${variants}<div class="lock"
      ><svg viewBox="0 0 40 45">
        <path d="M10 20V13a10 10 0 0 1 20 0v7" fill="none" stroke="currentColor" stroke-width="3" />
        <rect
          x="6"
          y="19"
          width="28"
          height="23"
          rx="4"
          fill="#162032"
          stroke="currentColor"
          stroke-width="2"
        />
        <circle cx="20" cy="29" r="3" fill="currentColor" />
        <path d="M20 30v6" stroke="currentColor" stroke-width="2" /></svg></div
  ></div>
  <div class="pointer"
    ><div class="click-ring"></div>${arrow}<div class="pointer-badge"
      >{{pointerlogo}}</div
    ></div
  >
</div>`;
  const css = road_styles;
  return scene(t, c, w, font, o, html, paletteCss + css, roadSetup, events, entries, {
    code: codeLines,
    palette,
  });
}
const roadSetup = road_animation;
