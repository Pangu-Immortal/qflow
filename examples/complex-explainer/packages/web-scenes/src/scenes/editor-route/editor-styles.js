// Final pink treatment; layout and paint for the editor part of the scene.
export const editorStyles = `.editor {
  position: absolute;
  inset: 0;
  transform-origin: center center;
  background: #fff7fb;
  border: 4px solid var(--ink);
  border-radius: 12px;
  box-shadow: 10px 12px 0 var(--ink);
  overflow: hidden;
}
.editor-bar {
  height: 42px;
  display: flex;
  gap: 9px;
  align-items: center;
  padding: 0 18px;
  background: var(--pinkSoft);
  border-bottom: 3px solid var(--ink);
}
.editor-bar i {
  background: #e46876;
  border-radius: 2px;
  border: 1px solid var(--ink);
  width: 12px;
  height: 12px;
}
.editor-bar i:nth-child(2) {
  background: #e8bd73;
}
.editor-bar i:nth-child(3) {
  background: #71bf98;
}
.editor-bar b {
  margin-left: 20px;
  font: 16px monospace;
  letter-spacing: 3px;
  color: var(--ink);
  font-weight: 700;
}
.editor-bar span {
  margin-left: auto;
  font: 17px monospace;
  color: var(--ink);
  font-weight: 700;
}
.editor-top {
  display: flex;
  padding: 12px;
  gap: 12px;
  height: 310px;
}
.library {
  width: 150px;
  padding: 12px;
  background: #fce5ef;
  color: #402b40;
  border: 2px solid #edc5d8;
}
.library small {
  font: 12px monospace;
  letter-spacing: 2px;
  color: #574158;
  font-weight: 700;
}
.properties small {
  font: 12px monospace;
  letter-spacing: 2px;
  color: #574158;
  font-weight: 700;
}
.library-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}
.library-grid i {
  display: grid;
  place-items: center;
  font: 25px monospace;
  color: #b2d7ea;
  height: 76px;
  background: #fff9fc;
  border: 2px solid var(--ink);
  border-radius: 5px;
  box-shadow: 3px 3px 0 var(--ink);
  overflow: hidden;
}
.preview {
  position: relative;
  width: 620px;
  overflow: hidden;
  background: #f4ecf3;
}
.preview-grid {
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(#ddcfdf60 0 25%, transparent 0 50%);
  background-size: 24px 24px;
}
.picture {
  position: absolute;
  overflow: hidden;
  border: 3px solid var(--ink);
  box-shadow: 5px 5px 0 var(--ink);
}
.picture > * {
  object-fit: contain !important;
}
.p0 {
  left: 204px;
  top: 12px;
  width: 140px;
  height: 248px;
}
.p1 {
  left: 22px;
  top: 58px;
  width: 174px;
  height: 121px;
  transform: rotate(-7deg);
}
.p2 {
  right: 56px;
  top: 32px;
  width: 112px;
  height: 199px;
  transform: rotate(7deg);
}
.preview-label {
  position: absolute;
  left: 15px;
  bottom: 10px;
  font: 11px monospace;
  letter-spacing: 3px;
  color: #795870;
}
.properties {
  width: 160px;
  padding: 12px;
  font: 12px monospace;
  background: #fce5ef;
  color: #402b40;
  border: 2px solid #edc5d8;
}
.properties p {
  display: flex;
  justify-content: space-between;
  margin: 12px 0;
}
.properties i {
  font-style: normal;
  padding: 4px 8px;
  background: #fff9fc;
  border: 1px solid #ccabc1;
  min-width: 45px;
  text-align: center;
}
.properties > div {
  height: 45px;
  border-top: 1px solid #56677944;
  margin-top: 25px;
}
.timeline {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 17px;
  height: 235px;
  transform-origin: center center;
  background: #fff7fb;
  border: 2px solid var(--ink);
}
.ticks {
  height: 31px;
  display: flex;
  justify-content: space-around;
  font: 12px monospace;
  border-bottom: 1px solid #8395a93d;
  align-items: center;
  color: #684b64;
  border-bottom-color: #d7b8cc;
}
.lane-lines {
  position: absolute;
  inset: 32px 0 0;
  background: repeating-linear-gradient(
    180deg,
    transparent 0 53px,
    #d8bfd23d 53px 54px
  );
}
.clip {
  position: absolute;
  height: 44px;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8a0c8;
  border: 2px solid var(--ink);
  border-radius: 4px;
}
.clip > div {
  height: 100%;
  width: 45px;
}
.clip > div > * {
  object-fit: contain !important;
}
.clip b {
  font: 11px monospace;
  color: var(--ink);
  font-weight: bold;
}
.clip-1 {
  background: #d0b6f2;
  border-color: var(--ink);
}
.clip-3 {
  background: #d0b6f2;
  border-color: var(--ink);
}
.audio {
  position: absolute;
  left: 65px;
  right: 25px;
  top: 153px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #b2dfc6;
  border: 2px solid var(--ink);
}
.audio i {
  display: block;
  width: 4px;
  background: #537e64;
}
.caption-blocks {
  position: absolute;
  left: 70px;
  top: 198px;
  display: flex;
  gap: 9px;
}
.caption-blocks i {
  display: block;
  width: 200px;
  padding: 3px 8px;
  font: 13px sans-serif;
  font-style: normal;
  background: #f4dca8;
  color: #483627;
  border-radius: 2px;
  border: 1px solid #715b44;
}
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #b92768;
  box-shadow: none;
}
.playhead:before {
  content: "";
  position: absolute;
  left: -5px;
  top: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 9px solid #f0d8aa;
  border-top-color: #b92768;
}
.editor-veil {
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(#000a 0 25%, #0006 0 50%);
  background-size: 5px 5px;
  opacity: 0;
}
.failed-path {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  filter: drop-shadow(0 0 6px #e83f5f);
}
.keys {
  position: absolute;
  inset: 0;
  opacity: 0;
}
.diamond {
  position: absolute;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  opacity: 0;
  background: #f5529a;
  filter: drop-shadow(1px 1px 0 var(--ink));
  width: 14px;
  height: 25px;
}
.key-label {
  position: absolute;
  top: 15px;
  left: 0;
  width: 100%;
  text-align: center;
  opacity: 0;
  display: none;
}
.key-label small {
  display: block;
  font: 18px monospace;
  letter-spacing: 6px;
  color: #c7b5ae;
  margin-bottom: 15px;
}
.key-label b {
  font-size: 68px;
  color: #ff869c;
  text-shadow: 0 0 24px #df4c7977;
}
.pointer {
  position: absolute;
  left: 0;
  top: 0;
  width: 70px;
  height: 90px;
  z-index: 20;
  opacity: 0;
  transform-origin: 8px 6px;
  filter: drop-shadow(4px 5px 0 var(--ink));
}
.pointer > svg {
  width: 70px;
  height: 90px;
}
.pointer-badge {
  position: absolute;
  left: 45px;
  top: 65px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: #f5f8fb;
  border: 3px solid var(--ink);
  box-shadow: 3px 3px 0 var(--ink);
}
.click-ring {
  position: absolute;
  left: -17px;
  top: -17px;
  width: 50px;
  height: 50px;
  border: 2px solid #89e9f4;
  border-radius: 50%;
  opacity: 0;
  border-color: #ed438f;
}
.library-grid i > * {
  object-fit: contain !important;
}
.library-wave {
  height: 39px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 17px;
  background: var(--mint);
  border: 2px solid var(--ink);
  padding: 3px;
}
.library-wave i {
  width: 3px;
  background: #375442;
}
.properties > div.control-stack {
  height: auto;
  border: 0;
  margin-top: 18px;
  display: grid;
  gap: 14px;
}
.control-stack > b {
  display: block;
  height: 5px;
  background: #c4a8bb;
  position: relative;
}
.control-stack i {
  position: absolute;
  top: -5px;
  left: 35%;
  height: 15px;
  width: 12px;
  min-width: 0;
  padding: 0;
  background: var(--pink);
  border: 2px solid var(--ink);
  border-radius: 2px;
}
.control-stack > b:nth-child(2) i {
  left: 65%;
}
.control-stack > b:nth-child(3) i {
  left: 45%;
}
.properties > div.align-tools {
  height: 32px;
  display: flex;
  gap: 8px;
  margin-top: 23px;
  border: 0;
}
.align-tools b {
  flex: 1;
  border: 2px solid var(--ink);
  background: #fff9fc;
  display: grid;
  place-items: center;
  box-shadow: 2px 2px 0 var(--ink);
}`;
