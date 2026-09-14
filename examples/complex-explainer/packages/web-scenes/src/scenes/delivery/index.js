import { css } from "./styles.js";
import { animation } from "./animation.js";
import { scene } from "../../shared/scene.js";
import { pointer, workCss, workSetup } from "../../shared/workshop-language.js";
import { studioBar, inspector, miniTimeline, studioCss } from "../../shared/studio-art.js";
import { qflowSymbol } from "../../shared/brand-marks.js";
const social = () =>
  `<div class="phone-social"><div class="avatar-dot">${qflowSymbol}</div><b>♥<small class="heart-total">120</small></b><b>▣<small class="comment-total">24</small></b><b>➦<small class="share-total">18</small></b></div>`;
export function renderDeliveryWorkshop(t, c, w, font, o, events, m) {
  const b = Object.fromEntries(events.map((e) => [e.name, e.at.frame - w.span.startFrame])),
    end = w.span.endFrameExclusive - w.span.startFrame;
  const entries = {
    preview: { media: m.film, start: 0, end: b.upload + 20 },
    phoneFilm: { media: m.film, start: 0, end, holdLast: true },
    phoneClone: { media: m.clone, start: b.compare, end, holdLast: true },
    ourWater: { media: m.water, start: b.meta, end, holdLast: true },
    theirWater: { image: m.reference },
    host: { image: m.host },
    thumb1: { image: m.thumb1 },
    thumb2: { image: m.thumb2 },
    thumb3: { image: m.thumb3 },
  };
  const html = `
<div class="work-ground"></div
><div class="delivery-studio hs-window"
  >${studioBar()}<div class="delivery-assets hs-library"
    ><div class="hs-tab">Results　 ▦</div><div class="asset-grid">${["host", "thumb1", "thumb2", "thumb3"].map((n, i) => `<div class="asset-thumb asset-${i}"><div class="asset-picture">{{${n}}}</div><div class="pixel-loading">${Array.from({ length: 9 }, (_, j) => `<i style="--j:${j}"></i>`).join("")}</div><div class="asset-progress"><i></i></div><span>${["HOST", "Qflow", "Creatify", "Higgsfield"][i]}</span></div>`).join("")}</div></div
  ><div class="hs-preview-label hs-tab">Preview</div
  ><div class="hs-preview-matte"></div>${inspector()}<div class="studio-film">{{preview}}</div
  >${miniTimeline()}</div
><div class="phone phone-left"
  ><div class="phone-camera"></div
  ><div class="phone-screen"
    ><div class="phone-post post-film">{{phoneFilm}}</div
    ><div class="phone-post post-water">{{ourWater}}</div
    ><div class="phone-brand">${qflowSymbol}<b>Qflow</b></div
    >${social()}<div class="phone-bottom">@qflow　　♫ original sound</div
    ><div class="floating-hearts">${Array.from({ length: 8 }, () => "<i>♥</i>").join("")}</div></div
  ><div class="phone-home"></div></div
><div class="phone phone-right"
  ><div class="phone-camera"></div
  ><div class="phone-screen"
    ><div class="phone-post post-clone">{{phoneClone}}</div
    ><div class="phone-post post-reference">{{theirWater}}</div>${social()}<div
      class="phone-bottom"
      >For You　　Following</div
    ><div class="phone-question">?</div></div
  ><div class="phone-home"></div></div
>${pointer}`;
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
