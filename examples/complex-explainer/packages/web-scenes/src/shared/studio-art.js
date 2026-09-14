import { qflowSymbol } from "./brand-marks.js";
export const studioBar = () =>
  `<div class="hs-bar"><div class="hs-brand">${qflowSymbol}<b>Qflow</b></div><span>Studio</span><span>main.svml</span><i>◧</i><i>◇</i><i>×</i></div>`;
export const inspector = () =>
  `<aside class="hs-inspector"><div class="hs-tab">Where　When　How</div><div class="hs-inspect-body"><b>Transform</b><div class="hs-fields"><span>X　50</span><span>Y　50</span><span>W　100</span><span>H　100</span></div><b>Appearance</b><div class="hs-swatches"><i></i><i></i><i></i><i></i></div><div class="hs-slider"><i></i></div><div class="hs-slider short"><i></i></div><b>Typography</b><div class="hs-select">Mono　　⌄</div><div class="hs-align">≡　　 ≡　　 ≡</div></div></aside>`;
export const librarySide = () =>
  `<aside class="hs-library"><div class="hs-tab">Components　▦</div><div class="hs-library-grid">${["CC", "▤", "▥", "◇"].map((v, i) => `<div><b>${v}</b><span>${["Caption", "Ranking", "Chart", "Card"][i]}</span></div>`).join("")}</div><div class="hs-mini-code">&lt;Film&gt;<br>　&lt;Track /&gt;<br>　&lt;Track /&gt;<br>&lt;/Film&gt;</div></aside>`;
export const miniTimeline = () =>
  `<div class="hs-timeline"><div class="hs-tab">Timeline <span>00:00　　00:05　　00:10</span></div>${["Performance", "Caption", "MG"].map((v, i) => `<div class="hs-lane"><b>${v}</b><div><i class="hs-clip clip-${i}"></i><i class="hs-clip small clip-${i}"></i></div></div>`).join("")}<div class="hs-playhead"></div></div>`;
export function faceless(index = 0) {
  const cloth = ["#fff8ef", "#f7c7d9", "#d9cef2"][index],
    shade = ["#e4dce5", "#df9eba", "#b8a5d7"][index],
    navy = ["#35384f", "#69445b", "#4a4169"][index];
  return `
<svg class="faceless" viewBox="0 0 360 640">
  <rect width="360" height="640" fill="${["#eddae1", "#f0dfe5", "#e6ddf0"][index]}" />
  <path
    d="M0 85H75V107H0M280 60H360V82H280M0 530H80V547H0"
    stroke="#fff9ed"
    stroke-width="8"
    opacity=".75"
  />
  <path
    d="M311 497V285M311 355Q275 322 278 296M312 394Q346 347 347 325"
    fill="none"
    stroke="#b49ab7"
    stroke-width="8"
  />
  <rect x="283" y="471" width="61" height="77" rx="5" fill="#bea1b6" />
  <g class="faceless-person">
    <path
      d="M90 303Q61 218 103 135Q124 98 183 98Q250 98 265 158Q285 229 264 322L284 460Q256 482 231 448H104Q69 468 65 416Z"
      fill="#342d36"
      stroke="#4d3944"
      stroke-width="4"
    />
    <path
      d="M43 640L51 373Q58 321 129 311L232 311Q300 320 307 373L324 640"
      fill="${cloth}"
      stroke="#806b80"
      stroke-width="3"
    />
    <path
      d="M63 378Q47 466 42 558L62 640H119L109 433M262 378L288 548L269 640H324"
      fill="${shade}"
      opacity=".52"
    />
    <path d="M151 273V324L181 352L212 324V273" fill="#f4cbb8" />
    <path
      d="M147 320L181 379L217 320L251 331L236 438L181 414L126 438L105 331Z"
      fill="${navy}"
      stroke="#615365"
      stroke-width="2"
    />
    <path
      d="M111 336L133 426L180 402L229 426L245 336"
      fill="none"
      stroke="${cloth}"
      stroke-width="6"
    />
    <path d="M144 331L180 394L217 332L210 432L180 481L150 432Z" fill="#f4cbb8" />
    <path
      d="M139 439L153 640M222 439L210 640"
      fill="none"
      stroke="${navy}"
      stroke-width="8"
    />
    <path
      d="M58 340L113 326L121 347L68 364Z M249 328L304 343L294 366L240 349Z"
      fill="${navy}"
      stroke="#534957"
      stroke-width="2"
    />
    <path
      d="M72 337L81 359M87 333L96 355M102 329L110 350M253 332L245 352M269 336L261 357M284 340L276 361"
      stroke="#dfc27a"
      stroke-width="6"
    />
    <ellipse cx="181" cy="221" rx="63" ry="86" fill="#f4cbb8" />
    <path
      d="M109 189Q107 135 147 125L205 126Q244 137 254 191Q220 181 211 156Q192 183 140 191L119 234Z"
      fill="#342d36"
    />
    <path
      d="M120 187Q95 283 115 383Q123 426 99 475Q142 491 147 448Q150 420 137 389Q112 324 137 261Z"
      fill="#3a3038"
    />
    <path
      d="M111 274Q102 360 127 411Q139 454 114 467"
      fill="none"
      stroke="#5c454e"
      stroke-width="5"
    />
    <path d="M240 180Q273 242 250 321L269 389Q243 409 230 388L225 285Z" fill="#332d35" />
    <path
      d="M82 149Q63 117 94 91Q102 69 137 74Q170 47 207 66Q240 64 258 84Q294 91 283 130L275 159Z"
      fill="${cloth}"
      stroke="#786a79"
      stroke-width="3"
    />
    <path
      d="M89 127Q180 108 275 136L272 165Q175 143 90 164Z"
      fill="${navy}"
      stroke="#282b3b"
      stroke-width="3"
    />
    <path d="M93 151Q183 129 271 155" fill="none" stroke="#e6cb85" stroke-width="6" />
    <path
      d="M90 164Q172 129 270 165L252 181Q178 158 112 182Z"
      fill="#303346"
      stroke="#73677a"
      stroke-width="3"
    />
    <g
      transform="translate(182 96)"
      fill="none"
      stroke="#dec274"
      stroke-width="5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cy="-11" r="6" />
      <path d="M0-5V21M-12 3H12M-23 10Q-22 26 0 28Q22 26 23 10M-23 10L-25 19M23 10L25 19" />
    </g>
    <path d="M244 261V285" stroke="#eee7df" stroke-width="3" />
    <path d="M244 279L250 287L244 295L238 287Z" fill="#fff9df" stroke="#b9a7a9" stroke-width="2" />
    <circle cx="230" cy="388" r="5" fill="#dfc17d" />
    <circle cx="225" cy="404" r="5" fill="#dfc17d" />
    <path d="M87 552H271L299 640H58Z" fill="${cloth}" stroke="#b6a7b9" stroke-width="2" />
    <path
      d="M114 558L97 640M148 558L142 640M188 558L195 640M226 558L249 640"
      stroke="${shade}"
      stroke-width="5"
    />
    <g transform="rotate(6 178 420)">
      <rect x="164" y="357" width="27" height="188" rx="7" fill="#303038" />
      <rect
        x="145"
        y="302"
        width="65"
        height="94"
        rx="29"
        fill="#272933"
        stroke="#59505b"
        stroke-width="2"
      />
      <text
        x="177"
        y="353"
        text-anchor="middle"
        font-size="13"
        font-family="monospace"
        fill="#fff7f1"
        font-weight="bold"
      >
        QFLOW
      </text>
      <path
        d="M160 416Q155 392 166 389L187 389Q202 394 201 410L196 451L173 476L156 453Z"
        fill="#f4cbb8"
        stroke="#c19e91"
        stroke-width="2"
      />
      <path
        d="M167 403L191 407M166 414L191 417M167 425L188 427"
        stroke="#d5ac9c"
        stroke-width="2"
      />
    </g>
    <g class="faceless-hand">
      <path
        d="M282 548L260 485L255 450L243 424Q240 412 247 410L263 431L265 392Q271 381 277 395L279 426L285 404Q290 396 294 404L294 434Q309 446 306 464L299 489L313 540Z"
        fill="#f4cbb8"
        stroke="#c09b91"
        stroke-width="2"
      />
      <path d="M269 430L281 448M294 434L291 455" fill="none" stroke="#d3aa9b" stroke-width="2" />
    </g>
  </g>
</svg>`;
}
export const studioCss = `
.hs-window {
  position: absolute;
  left: 35px;
  top: 650px;
  width: 1010px;
  height: 750px;
  background: #f8e8f0;
  border: 4px solid #39283a;
  border-radius: 9px;
  box-shadow: 11px 13px #39283a;
  overflow: hidden;
}
.hs-bar {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 28px;
  border-bottom: 3px solid #39283a;
  background: #f1a8ca;
  padding: 0 16px;
  font:
    21px Menlo,
    monospace;
}
.hs-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hs-brand svg {
  width: 30px;
  height: 30px;
}
.hs-bar > span:nth-of-type(1) {
  background: #fff0f7;
  border: 2px solid #9b668b;
  padding: 4px 10px;
  border-radius: 4px;
}
.hs-bar > span:nth-of-type(2) {
  color: #754e6b;
  font-size: 18px;
}
.hs-bar > i:first-of-type {
  margin-left: auto;
}
.hs-bar > i {
  font-style: normal;
}
.hs-tab {
  height: 37px;
  padding: 8px 12px;
  background: #ecd6e4;
  border-bottom: 2px solid #b99bae;
  font:
    17px Menlo,
    monospace;
  color: #69475e;
}
.hs-library {
  position: absolute;
  top: 52px;
  bottom: 226px;
  width: 250px;
  background: #f9edf4;
  border-right: 2px solid #b99bae;
}
.hs-library-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  padding: 18px 14px;
}
.hs-library-grid > div {
  text-align: center;
  font: 15px monospace;
}
.hs-library-grid b {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ecd8f3;
  border: 2px solid #a078a2;
  box-shadow: 3px 4px #d0b2c9;
  font-size: 32px;
  color: #8a628e;
}
.hs-library-grid span {
  display: block;
  margin-top: 9px;
}
.hs-mini-code {
  margin: 18px;
  color: #b18aa9;
  font: 19px/1.65 monospace;
}
.hs-inspector {
  position: absolute;
  right: 0;
  top: 52px;
  bottom: 226px;
  width: 240px;
  background: #f9edf4;
  border-left: 2px solid #b99bae;
}
.hs-inspect-body {
  padding: 18px 14px;
  font: 16px monospace;
}
.hs-inspect-body > b {
  display: block;
  margin: 8px 0 16px;
  color: #755a70;
}
.hs-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  margin-bottom: 22px;
}
.hs-fields span,
.hs-select {
  padding: 8px;
  background: #f0e0ec;
  border: 1px solid #c5a8bc;
  border-radius: 3px;
}
.hs-swatches {
  display: flex;
  gap: 10px;
  margin: 12px 0;
}
.hs-swatches i {
  width: 29px;
  height: 29px;
  background: #e797be;
  border: 2px solid #9a6d8a;
}
.hs-swatches i:nth-child(2) {
  background: #cab0e8;
}
.hs-swatches i:nth-child(3) {
  background: #f2d097;
}
.hs-swatches i:nth-child(4) {
  background: #fff3e7;
}
.hs-slider {
  height: 4px;
  background: #c4a2ba;
  margin: 24px 4px;
  position: relative;
}
.hs-slider i {
  position: absolute;
  left: 65%;
  top: -6px;
  width: 15px;
  height: 15px;
  background: #fff4ef;
  border: 2px solid #a86c98;
  border-radius: 3px;
}
.hs-slider.short i {
  left: 30%;
}
.hs-align {
  margin: 20px 0;
}
.hs-preview-label {
  position: absolute;
  left: 250px;
  right: 240px;
  top: 52px;
}
.hs-preview-matte {
  position: absolute;
  left: 250px;
  right: 240px;
  top: 89px;
  bottom: 226px;
  background: #e5cede;
  background-image: radial-gradient(#ba93b0 1px, transparent 1px);
  background-size: 16px 16px;
}
.hs-timeline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 226px;
  border-top: 3px solid #98738f;
  background: #f8eaf3;
}
.hs-timeline .hs-tab span {
  margin-left: 110px;
}
.hs-lane {
  display: flex;
  align-items: center;
  height: 51px;
  border-bottom: 1px solid #e1c9da;
  font: 17px monospace;
}
.hs-lane > b {
  width: 155px;
  padding: 0 13px;
  color: #805b75;
}
.hs-lane > div {
  display: flex;
  gap: 7px;
  width: 800px;
}
.hs-clip {
  display: block;
  width: 470px;
  height: 32px;
  border: 2px solid #94749c;
  background: #d8c0ed;
  border-radius: 3px;
}
.hs-clip.small {
  width: 165px;
}
.hs-clip.clip-1 {
  background: #e8c680;
  border-color: #b39b60;
  width: 280px;
}
.hs-clip.clip-2 {
  background: #f3b7d6;
  border-color: #b884a9;
  width: 330px;
}
.hs-playhead {
  position: absolute;
  left: 300px;
  top: 38px;
  bottom: 0;
  border-left: 3px solid #e85f89;
}
.faceless {
  width: 100%;
  height: 100%;
  display: block;
}
.faceless-hand {
  transform-origin: 285px 500px;
}
.hs-handle {
  height: 14px;
  position: absolute;
  left: 0;
  right: 0;
  top: -8px;
  cursor: ns-resize;
}
.hs-handle:after {
  content: "";
  position: absolute;
  width: 90px;
  height: 5px;
  border-radius: 3px;
  background: #a5819c;
  left: 45%;
  top: 4px;
}
`;
export const portraitMotion = `
$$(".faceless-person").forEach(
  (el, i) =>
    (el.style.transform =
      "translateY(" + Math.sin(f * 0.045 + i) * 2 + "px)"),
);
$$(".faceless-hand").forEach(
  (el, i) =>
    (el.style.transform = "rotate(" + Math.sin(f * 0.08 + i) * 7 + "deg)"),
);`;
