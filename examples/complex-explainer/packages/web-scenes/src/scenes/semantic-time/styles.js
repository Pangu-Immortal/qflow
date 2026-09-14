// This scene owns its fixed design. External events arrive as projected frames.
export const css = `
.semantic-studio {
  top: 650px;
  height: 750px;
}
.semantic-person {
  position: absolute;
  left: 405px;
  top: 94px;
  width: 240px;
  height: 420px;
  border: 3px solid #a87a9a;
  overflow: hidden;
}
.mini-result {
  position: absolute;
  left: 25px;
  bottom: 70px;
  background: #ffe1a4;
  border: 3px solid #9c7293;
  padding: 10px;
  font: bold 26px monospace;
}
.semantic-board {
  top: 1120px;
  height: 388px;
  overflow: visible;
  transform-origin: top center;
  z-index: 3;
}
.semantic-row {
  height: 52px;
  display: flex;
  border-bottom: 2px solid #dabccc;
  font: 20px monospace;
}
.semantic-row > b {
  width: 130px;
  flex: none;
  font:
    17px Menlo,
    monospace;
  padding: 15px 10px;
  color: #85516d;
  border-right: 2px solid #dabccc;
}
.semantic-row-body {
  position: relative;
  width: 850px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.seconds {
  height: 43px;
}
.seconds .semantic-row-body {
  justify-content: space-between;
  font: 16px monospace;
}
.segments i {
  width: 100%;
  height: 33px;
  padding: 4px 10px;
  background: #dfbeed;
  border: 2px solid #927094;
  border-radius: 3px;
  font: 19px monospace;
}
.word-bank {
  position: absolute;
  left: 12px;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}
.words .word {
  white-space: nowrap;
  font: 23px sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 41px;
  flex: none;
  padding: 0;
  background: #fee6b6;
  border: 2px solid #b59868;
  border-radius: 3px;
}
.selected-words {
  position: absolute;
  top: 7px;
  height: 35px;
  background: #dcb8eb;
  border: 2px solid #8d669c;
  border-radius: 4px;
  padding: 4px 8px;
  font: 20px monospace;
}
.semantic-moment {
  position: absolute;
  width: 12px;
  height: 29px;
  background: #e76c89;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  top: 10px;
}
.effect-lane {
  height: 68px;
  position: relative;
  display: flex;
}
.effect-lane > b {
  width: 130px;
  padding: 15px 12px;
  font: 19px monospace;
}
.effect-window {
  position: absolute;
  top: 10px;
  height: 47px;
  background: #edadd0;
  border: 3px solid #8b5176;
  border-radius: 4px;
  font: 21px sans-serif;
  padding: 8px 12px;
}
.effect-window i {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 11px;
  background: #bf70a0;
  border-left: 2px solid #8b5176;
}
.semantic-playhead {
  position: absolute;
  top: 96px;
  height: 265px;
  border-left: 3px solid #e76888;
  pointer-events: none;
}
.semantic-preview {
  top: 510px;
  height: 350px;
}
.preview-rank {
  position: absolute;
  left: 220px;
  top: 100px;
  width: 540px;
  height: 170px;
  background: #ffde95;
  border: 4px solid #382535;
  box-shadow: 8px 10px #382535;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  font: bold 53px monospace;
  transform-origin: center;
}
.preview-rank svg {
  height: 105px;
  width: 115px;
}
.preview-tiles {
  position: absolute;
  left: 100px;
  bottom: 25px;
  display: flex;
  gap: 17px;
}
.preview-tiles i {
  width: 170px;
  height: 25px;
  background: #ead5f0;
  border: 2px solid #c59dbd;
}
.semantic-examples {
  position: absolute;
  left: 35px;
  top: 710px;
  width: 1010px;
  height: 565px;
}
.rank-example {
  position: absolute;
  left: 0;
  width: 480px;
  height: 400px;
  background: #fff3e1;
  border: 4px solid #382535;
  box-shadow: 9px 11px #382535;
  border-radius: 7px;
  padding: 16px;
}
.rank-heading {
  font: bold 25px monospace;
  margin-bottom: 15px;
  letter-spacing: 2px;
}
.rank-slot {
  height: 91px;
  margin: 12px 0;
  background: #f5c8df;
  border: 3px solid #382535;
  padding: 12px 14px;
  font: 29px monospace;
  display: flex;
  align-items: center;
  gap: 12px;
}
.rank-slot b {
  font-size: 27px;
}
.rank-number {
  width: 40px;
  flex: none;
}
.rank-icon {
  width: 53px;
  height: 53px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rank-icon > * {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}
.rank-slot.first {
  position: relative;
  background: #ffdc91;
  padding: 0;
  perspective: 700px;
}
.rank-front,
.rank-back {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 20px;
  backface-visibility: hidden;
  transform-origin: center;
}
.rank-back {
  background: #ffdc91;
}
.rank-back span {
  width: 66px;
  height: 63px;
}
.rank-back svg {
  width: 100%;
  height: 100%;
}
.sentence-example {
  position: absolute;
  right: 0;
  top: 0;
  width: 480px;
  height: 400px;
  background: #dfcef0;
  border: 4px solid #382535;
  box-shadow: 9px 11px #382535;
  border-radius: 7px;
  text-align: center;
  padding-top: 45px;
  overflow: visible;
}
.blank-brand {
  height: 119px;
  width: 140px;
  border-bottom: 5px dashed #957caa;
  margin: 0 auto 32px;
}
.claim {
  font:
    bold 31px/1.65 Menlo,
    monospace;
}
.claim b {
  background: #ffdea0;
  padding: 5px 8px;
}
.flying-brand {
  position: absolute;
  left: 167px;
  top: 45px;
  width: 140px;
  height: 124px;
}
.flying-brand svg {
  width: 100%;
  height: 100%;
}
.pixel-stars {
  position: absolute;
  inset: 25px 0 auto;
  color: #e5a83b;
  font: 34px monospace;
  letter-spacing: 35px;
}
.rewrite-sheet {
  top: 685px;
  height: 330px;
}
.rewrite-old,
.rewrite-new {
  position: absolute;
  top: 80px;
  left: 30px;
  font: 34px/1.6 sans-serif;
}
.rewrite-old b,
.rewrite-new b {
  background: #f4d899;
  border-bottom: 3px solid #ca9e53;
}
.voice-shape {
  position: absolute;
  left: 33px;
  right: 200px;
  bottom: 25px;
  height: 75px;
  display: flex;
  gap: 4px;
  align-items: center;
}
.voice-shape i {
  width: 5px;
  background: #c074a5;
  flex: none;
}
.voice-chip {
  position: absolute;
  right: 20px;
  bottom: 32px;
  font: 22px sans-serif;
  padding: 12px;
  background: #d5b9ed;
  border: 2px solid #382535;
}
.script-source {
  top: 665px;
  height: 765px;
}
.script-source pre {
  font:
    27px/1.55 Menlo,
    monospace;
  padding: 30px 20px;
  white-space: pre-wrap;
  margin: 0;
}
.source-line {
  position: relative;
  display: flex;
  min-height: 42px;
}
.source-line-no {
  font: 18px/42px monospace;
  color: #c4a3b9;
  width: 36px;
  flex: none;
  border-right: 1px solid #e6cbdb;
  margin-right: 12px;
  font-style: normal;
}
.source-line-body {
  white-space: pre;
  color: #58405b;
}
.script-source span {
  color: #976ea7;
}
.script-source em {
  font-style: normal;
  background: #f7cdda;
  color: #bc3b77;
  padding: 4px;
}
`;
