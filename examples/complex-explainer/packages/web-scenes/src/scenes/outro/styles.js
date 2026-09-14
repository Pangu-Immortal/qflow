// This scene owns its fixed design. External events arrive as projected frames.
export const css = `
:scope {
  background: transparent;
  color: #382535;
}
.backdrop {
  display: block;
  opacity: 0;
}
.backdrop-wash {
  display: none;
}
.outro-ground {
  position: absolute;
  inset: 0;
  background: #fce5ee;
  background-image: radial-gradient(#efb9d0 1.5px, transparent 1.5px);
  background-size: 24px 24px;
  opacity: 0;
}
.outro-page {
  position: absolute;
  left: 0;
  top: 530px;
  width: 1080px;
  height: 910px;
  overflow: hidden;
}
.outro-page > * {
  object-fit: cover !important;
  object-position: center top !important;
}
.copy-panel,
.install-panel {
  position: absolute;
  left: 55px;
  top: 820px;
  width: 970px;
  background: #fff2f9;
  border: 5px solid #382535;
  border-radius: 9px;
  box-shadow: 12px 14px 0 #382535;
  overflow: hidden;
  transform-origin: center;
}
.outro-bar {
  height: 60px;
  background: #f6a6ce;
  border-bottom: 4px solid #382535;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 0 24px;
  font:
    24px Menlo,
    monospace;
}
.outro-bar i {
  display: block;
  width: 16px;
  height: 16px;
  background: #fff4fa;
  border: 2px solid #382535;
}
.outro-bar i:nth-child(2) {
  background: #c7dfbc;
}
.outro-bar i:nth-child(3) {
  background: #cdbbe9;
}
.outro-bar span {
  margin-left: 15px;
}
.outro-bar b {
  margin-left: auto;
  font-size: 35px;
}
.copy-body {
  height: 235px;
  display: flex;
  align-items: center;
  padding: 0 26px;
  gap: 12px;
  font:
    36px Menlo,
    monospace;
  position: relative;
  z-index: 1;
}
.prompt-sign {
  color: #d9468e;
}
.copy-button {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font:
    18px Menlo,
    monospace;
  background: #f8bbda;
  border: 3px solid #382535;
  border-radius: 4px;
  padding: 14px 17px;
  box-shadow: 5px 5px 0 #382535;
}
.copy-button svg {
  width: 34px;
  height: 34px;
}
.copy-highlight {
  position: absolute;
  left: 65px;
  right: 130px;
  top: 155px;
  height: 43px;
  background: #f7bbda;
  opacity: 0;
}
.install-panel {
  top: 740px;
  min-height: 455px;
}
.install-body {
  padding: 25px 27px;
  font:
    32px/1.65 Menlo,
    monospace;
}
.install-body p {
  margin: 0 0 35px;
  white-space: nowrap;
}
.install-body p span {
  color: #cf4286;
}
.install-lines {
  color: #714358;
  white-space: pre-line;
}
.install-progress {
  margin-top: 35px;
  height: 16px;
  background: #f2d3e3;
  border: 2px solid #382535;
}
.install-progress i {
  display: block;
  height: 100%;
  width: 0;
  background: repeating-linear-gradient(
    90deg,
    #e95b9d 0 20px,
    #f49cc6 20px 25px
  );
}
.outro-pointer {
  position: absolute;
  left: 0;
  top: 0;
  width: 68px;
  height: 85px;
  filter: drop-shadow(4px 5px 0 #38253533);
  z-index: 4;
}
.outro-pointer > svg {
  width: 100%;
  height: 100%;
}
.pointer-badge {
  position: absolute;
  left: 39px;
  top: 43px;
  width: 40px;
  height: 40px;
  background: #fff4f9;
  border: 3px solid #382535;
  border-radius: 50%;
  padding: 7px;
}
.pointer-badge > * {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}
.click-ring {
  position: absolute;
  left: -18px;
  top: -18px;
  border: 5px solid #ed64a4;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  opacity: 0;
}
.portrait-waterfall {
  position: absolute;
  inset: 100px -35px 70px;
  display: flex;
  gap: 14px;
  overflow: hidden;
  mask-image: linear-gradient(transparent, #000 8%, #000 92%, transparent);
  transform: rotate(-3deg) scale(1.06);
}
.portrait-column {
  position: relative;
  width: 218px;
  flex: none;
  will-change: transform;
}
.portrait-column > * {
  width: 100% !important;
  height: auto !important;
  max-height: none !important;
  object-fit: contain !important;
  border-radius: 5px;
  box-shadow: 5px 6px 0 #382535;
}
.star-card {
  position: absolute;
  left: 78px;
  top: 1090px;
  width: 924px;
  border: 5px solid #382535;
  border-radius: 9px;
  background: #fff2f9;
  box-shadow: 12px 14px 0 #382535;
  transform-origin: center;
}
.star-top {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 27px;
  padding: 28px 20px 25px;
  font:
    bold 56px Menlo,
    monospace;
}
.github-icon {
  width: 70px;
  height: 70px;
  display: block;
}
.github-icon svg {
  width: 100%;
  height: 100%;
}
.star-bottom {
  background: #f59ac6;
  border-top: 4px solid #382535;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 25px;
  padding: 23px 12px;
  font:
    bold 44px Menlo,
    monospace;
}
.star {
  font-size: 56px;
  color: #fff6bd;
  -webkit-text-stroke: 2px #382535;
  paint-order: stroke fill;
  text-shadow: 3px 4px 0 #382535;
}
.tears {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 8;
  pointer-events: none;
}
.tear {
  transform-origin: 0 0;
}
.farewell-logo {
  position: absolute;
  left: 200px;
  top: 735px;
  width: 680px;
  height: 270px;
  filter: drop-shadow(5px 7px 0 #fff7fc);
  z-index: 2;
}
.farewell-logo svg {
  width: 100%;
  height: 100%;
}
.farewell-tagline {
  position: absolute;
  top: 300px;
  left: -120px;
  right: -120px;
  text-align: center;
  font:
    30px Menlo,
    monospace;
  color: #613443;
  letter-spacing: -1px;
  text-shadow: 2px 2px #fff7ed;
  white-space: nowrap;
  height: 150px;
}
.tagline-line {
  height: 73px;
  text-align: center;
}
.farewell-tagline .tagline-line svg {
  width: auto;
  height: 48px;
  max-width: 100%;
  filter: drop-shadow(2px 3px #fff8ef);
}
`;
