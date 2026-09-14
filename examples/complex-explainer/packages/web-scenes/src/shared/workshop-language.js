import { qflowSymbol } from "./brand-marks.js";
export const bar = (label) =>
  `<div class="work-bar"><i></i><i></i><i></i><span>${label}</span><b>×</b></div>`;
export const pointer = `<div class="work-pointer"><svg viewBox="0 0 60 76"><path d="M6 4L51 37L30 42L21 67Z" fill="#fff8ef" stroke="#382535" stroke-width="4"/><path d="M14 18L32 36L25 39L21 47Z" fill="#f39cbd"/></svg><div>${qflowSymbol}</div></div>`;
export const tiles = () =>
  ["字幕", "榜单", "图表", "卡片"]
    .map(
      (name, i) =>
        `
<div class="effect-tile effect-tile-${i}"
  ><div class="tile-cap">${name}<span>&lt;/&gt;</span></div
  ><div class="tile-art">${
    [
      '<div class="demo-caption"><span>MAKE</span><span>IT</span><span>YOURS</span></div>',
      '<div class="demo-ranking"><i>01 <b>Qflow</b></i><i>02 <b>Creatify</b></i><i>03 <b>Higgsfield</b></i></div>',
      '<div class="demo-chart"><i></i><i></i><i></i><i></i><i></i></div>',
      '<div class="demo-card"><span>★</span><b>HELLO!</b><i>MAKE SOMETHING GREAT</i></div>',
    ][i]
  }</div><div class="tile-corners"></div
></div>`,
    )
    .join("");
export const workCss = `
:scope {
  background: transparent;
  color: #382535;
  font-family: Menlo, monospace !important;
}
.backdrop,
.backdrop-wash {
  display: none;
}
.work-ground {
  position: absolute;
  inset: 0;
  background-color: #fce5ee;
  background-image: radial-gradient(#efb8cf 1.6px, transparent 1.6px);
  background-size: 28px 28px;
}
.work-window {
  position: absolute;
  left: 35px;
  top: 540px;
  width: 1010px;
  background: #fff4fa;
  border: 4px solid #382535;
  border-radius: 9px;
  box-shadow: 11px 13px 0 #382535;
  overflow: hidden;
}
.work-bar {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 17px;
  background: #f5acd0;
  border-bottom: 3px solid #382535;
  font:
    22px Menlo,
    monospace;
}
.work-bar i {
  height: 12px;
  width: 12px;
  border: 2px solid #382535;
  background: #fff5df;
}
.work-bar i:nth-child(2) {
  background: #cbb3ed;
}
.work-bar i:nth-child(3) {
  background: #eaca7a;
}
.work-bar span {
  margin-left: 18px;
}
.work-bar b {
  margin-left: auto;
}
.work-pointer {
  position: absolute;
  left: 0;
  top: 0;
  width: 65px;
  height: 82px;
  z-index: 60;
  filter: drop-shadow(3px 4px #38253533);
}
.work-pointer > svg {
  width: 100%;
  height: 100%;
}
.work-pointer > div {
  position: absolute;
  left: 37px;
  top: 45px;
  width: 44px;
  height: 44px;
  border: 3px solid #382535;
  border-radius: 50%;
  background: #fff7ec;
  padding: 6px;
}
.work-pointer > div svg {
  width: 100%;
  height: 100%;
}
.effect-tile {
  position: absolute;
  width: 415px;
  height: 270px;
  border: 4px solid #382535;
  border-radius: 8px;
  box-shadow: 8px 9px 0 #382535;
  background: #fff8ea;
  transform-origin: top left;
  overflow: hidden;
}
.tile-cap {
  height: 42px;
  background: #e8d9f4;
  border-bottom: 3px solid #382535;
  padding: 6px 15px;
  font: 23px sans-serif;
  opacity: 0;
}
.tile-cap span {
  float: right;
  font: bold 24px monospace;
}
.tile-art {
  position: absolute;
  inset: 47px 12px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tile-corners {
  position: absolute;
  inset: 5px;
  border: 3px dashed #b363a0;
  pointer-events: none;
  opacity: 0;
}
.demo-caption {
  display: flex;
  gap: 8px;
  transform: rotate(-5deg);
  font:
    bold 33px Menlo,
    monospace;
}
.demo-caption span {
  padding: 10px 6px;
  border-radius: 3px;
  color: #382535;
  text-shadow: 2px 2px #fff;
}
.demo-ranking {
  width: 88%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.demo-ranking i {
  display: block;
  background: #f6cee3;
  border: 2px solid #382535;
  padding: 7px 12px;
  font: 19px monospace;
}
.demo-ranking i:first-child {
  background: #ffdfa1;
}
.demo-ranking b {
  margin-left: 18px;
}
.demo-chart {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  height: 150px;
  border-bottom: 3px solid #382535;
  width: 85%;
  justify-content: center;
}
.demo-chart i {
  display: block;
  width: 42px;
  height: 130px;
  background: #c5a0e9;
  border: 3px solid #382535;
  transform-origin: bottom;
}
.demo-chart i:nth-child(2n) {
  background: #f18ebc;
}
.demo-card {
  width: 260px;
  height: 155px;
  background: #ffbbd8;
  border: 4px solid #382535;
  box-shadow: 8px 9px #382535;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotate(5deg);
}
.demo-card span {
  color: #fff1ab;
  font: 48px monospace;
  text-shadow: 3px 4px #382535;
}
.demo-card b {
  font: bold 28px monospace;
}
.demo-card i {
  font: 11px monospace;
}
.work-media {
  position: absolute;
  overflow: hidden;
}
.work-media > * {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.pixel-tag {
  background: #fff4d7;
  border: 3px solid #382535;
  box-shadow: 5px 6px #382535;
  padding: 10px 18px;
  font:
    26px Menlo,
    monospace;
}
`;
export const workSetup = `
const $ = (s) => root.querySelector(s),
  $$ = (s) => [...root.querySelectorAll(s)],
  mix = (a, z, q) => a + (z - a) * q,
  smooth = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  },
  pop = (x) => {
    x = clamp(x);
    return 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
  },
  show = (el, a) => {
    el.style.opacity = String(clamp(a));
    el.style.visibility = a > 0 ? "inherit" : "hidden";
  },
  move = (el, x, y, s = 1) =>
    (el.style.transform =
      "translate(" + x + "px," + y + "px) scale(" + s + ")");
const animateTiles = (f) => {
  $$(".demo-caption span").forEach((e, i) => {
    e.style.background =
      Math.floor(f / 12) % 3 === i ? "#f394c2" : "transparent";
    e.style.transform =
      "translateY(" + -4 * Math.max(0, Math.sin(f * 0.12 - i)) + "px)";
  });
  $$(".demo-ranking i").forEach(
    (e, i) =>
      (e.style.transform =
        "translateX(" + Math.sin(f * 0.05 + i) * 4 + "px)"),
  );
  $$(".demo-chart i").forEach(
    (e, i) =>
      (e.style.transform =
        "scaleY(" +
        (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(f * 0.065 + i))) +
        ")"),
  );
  $$(".demo-card").forEach(
    (e) =>
      (e.style.transform =
        "rotate(" +
        Math.sin(f * 0.05) * 7 +
        "deg) translateY(" +
        Math.sin(f * 0.08) * 6 +
        "px)"),
  );
};`;
