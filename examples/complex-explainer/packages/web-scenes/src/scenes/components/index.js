import { css } from "./styles.js";
import { animation } from "./animation.js";
import { qflowSymbol } from "../../shared/brand-marks.js";
import { scene } from "../../shared/scene.js";
import { pointer, tiles, workCss, workSetup } from "../../shared/workshop-language.js";
import {
  studioBar,
  inspector,
  librarySide,
  miniTimeline,
  faceless,
  studioCss,
  portraitMotion,
} from "../../shared/studio-art.js";
export function renderComponentWorkshop(t, c, w, font, o, events, m) {
  const b = Object.fromEntries(events.map((e) => [e.name, e.at.frame - w.span.startFrame]));
  const entries = {};
  for (let i = 0; i < 6; i++)
    entries["v" + i] = {
      media: m["v" + i],
      start: i < 3 ? b.variants : b.swap,
      end: w.span.endFrameExclusive - w.span.startFrame,
    };
  const html = `
<div class="work-ground"></div
><div class="component-editor hs-window"
  >${studioBar()}${librarySide()}<div class="hs-preview-label hs-tab">Preview</div
  ><div class="hs-preview-matte"></div>${inspector()}${miniTimeline()}</div
><div class="hero-person">${faceless(0)}</div><div class="tile-world">${tiles()}</div
><div class="copy-ghost"
  ><span class="drag-rank">#1</span><span class="drag-logo">${qflowSymbol}</span><b>Qflow</b
  ><div class="drag-bars"><i></i><i></i><i></i></div></div
><div class="component-library"
  ><div class="library-tab">&lt;/&gt;　组件库</div
  ><div class="library-rim"><i></i><i></i><i></i><b>4 COMPONENTS</b></div
  ><div class="library-slots"><i></i><i></i><i></i><i></i></div></div
><div class="new-creators">${[0, 1, 2].map((i) => `<div class="new-creator creator-${i}">${faceless(i)}</div>`).join("")}</div
><div class="variant-trio">${[0, 1, 2].map((i) => `<div class="trio-card card-${i}"><div class="trio-first">{{v${i}}}</div><div class="trio-next">{{v${i + 3}}}</div></div>`).join("")}</div>${pointer}`;
  return scene(
    t,
    c,
    w,
    font,
    o,
    html,
    workCss + studioCss + css,
    workSetup + animation,
    events,
    entries,
  );
}
