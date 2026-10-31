import { css } from "./styles.js";
import { animation } from "./animation.js";
import { pixelType } from "../../shared/pixel-type.js";
import { qflowWordmark } from "../../shared/brand-marks.js";
import { scene } from "../../shared/scene.js";
import { requireBeats } from "../../shared/beats.js";
const github = `
<svg viewBox="0 0 24 24" fill="currentColor">
  <path
    d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1.01 1.72 2.65 1.22 3.3.94.1-.73.4-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.02-.12-.28-.5-1.43.11-2.99 0 0 .95-.3 3.08 1.16a10.68 10.68 0 0 1 5.6 0c2.14-1.46 3.08-1.16 3.08-1.16.62 1.56.23 2.71.11 2.99.73.78 1.16 1.79 1.16 3.02 0 4.33-2.63 5.28-5.14 5.56.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z"
  />
</svg>`;
const cursor = `<svg viewBox="0 0 54 66"><path d="M5 3L46 33L28 37L20 58Z" fill="#fff7fc" stroke="#382535" stroke-width="4" stroke-linejoin="round"/><path d="M12 15L29 32L22 34L19 41Z" fill="#f57ab4"/></svg>`;
const copy = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/></svg>`;
export function renderOutro(t, c, w, font, o, events, m) {
  requireBeats(events, ["overtime", "github", "copy", "install", "gift", "bye", "end"]);
  const b = Object.fromEntries(events.map((e) => [e.name, e.at.frame - w.span.startFrame]));
  const entries = {
    codex: { image: m.codex },
    page: { media: m.page, start: b.github, end: b.copy + 8, backdrop: {} },
  };
  for (let i = 0; i < 5; i++) entries["portraits-" + i] = { image: m["portraits-" + i] };
  const html = `
<div class="outro-ground"></div
><svg class="tears" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="tear-color" x2="1" y2="0">
      <stop stop-color="#d0faff" />
      <stop offset=".5" stop-color="#70d9f3" />
      <stop offset="1" stop-color="#b4f1ff" />
    </linearGradient>
  </defs>
  ${[0, 1].map((i) => `<g class="tear tear-${i}"><path class="tear-stream" d="M-16 0H16V24H8V48H16V80H8V112H-8V88H-16V56H-8V32H-16Z" fill="#93e6ff" stroke="#397792" stroke-width="4" stroke-linejoin="miter"/><path d="M-8 8H0V24H-8ZM0 40H8V56H0ZM-8 72H0V88H-8Z" fill="#effcff"/><path class="tear-drop" d="M-8 128H8V136H16V152H8V160H-8V152H-16V136H-8Z" fill="#93e6ff" stroke="#397792" stroke-width="4"/><path class="tear-chip" d="M-26 170H-14V182H-26Z M18 190H30V202H18Z" fill="#a7ecff" stroke="#397792" stroke-width="3"/></g>`).join("")}</svg
><div class="outro-page">{{page}}</div>
<div class="copy-panel"
  ><div class="outro-bar"><i></i><i></i><i></i><span>INSTALL SKILL</span><b>×</b></div
  ><div class="copy-body"
    ><span class="prompt-sign">$</span><code>npx skills add Pangu-Immortal/qflow -g</code
    ><div class="copy-button">${copy}<span>Copy</span></div></div
  ><div class="copy-highlight"></div
></div>
<div class="install-panel"
  ><div class="outro-bar"><i></i><i></i><i></i><span>TERMINAL</span><b>×</b></div
  ><div class="install-body"
    ><p><span>$ </span><code class="installed-command"></code><b class="caret">▌</b></p
    ><div class="install-lines"></div><div class="install-progress"><i></i></div></div
></div>
<div class="outro-pointer"
  >${cursor}<div class="pointer-badge">{{codex}}</div><div class="click-ring"></div
></div>
<div class="portrait-waterfall">${Array.from({ length: 5 }, (_, i) => `<div class="portrait-column column-${i}">{{portraits-${i}}}</div>`).join("")}</div>
<div class="farewell-logo"
  >${qflowWordmark}<div class="farewell-tagline"
    ><div class="tagline-line">${pixelType("Clone any viral video")}</div
    ><div class="tagline-line">${pixelType("with AI agents.")}</div></div
  ></div
><div class="star-card"
  ><div class="star-top"
    ><span class="github-icon">${github}</span><span>Pangu-Immortal/qflow</span></div
  ><div class="star-bottom"
    ><span class="star left">★</span><span>Star us on GitHub!</span
    ><span class="star right">★</span></div
  ></div
>`;
  return scene(t, c, w, font, o, html, css, animation, events, entries, {
    command: "npx skills add Pangu-Immortal/qflow -g",
  });
}
