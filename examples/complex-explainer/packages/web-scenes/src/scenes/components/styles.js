// This scene owns its fixed design. External events arrive as projected frames.
export const css = `
.component-editor {
  top: 650px;
  height: 750px;
}
.hero-person {
  position: absolute;
  left: 0;
  top: 0;
  width: 360px;
  height: 640px;
  border: 3px solid #775169;
  box-shadow: 7px 9px #ad819b55;
  overflow: hidden;
  transform-origin: 0 0;
}
.tile-world {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
}
.effect-tile {
  transition: none;
}
.copy-ghost {
  position: absolute;
  left: 0;
  top: 0;
  width: 205px;
  height: 84px;
  background: #fff0c5f0;
  border: 3px solid #9f6289;
  color: #67405e;
  font: 27px monospace;
  padding: 10px;
  z-index: 20;
  box-shadow: 5px 7px #bc8aaa88;
  border-radius: 5px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  transform-origin: 0 0;
}
.drag-rank {
  font-weight: bold;
  color: #a77138;
}
.drag-logo {
  width: 35px;
  height: 35px;
}
.drag-logo svg {
  width: 100%;
  height: 100%;
}
.copy-ghost > b {
  font-size: 25px;
}
.drag-bars {
  position: absolute;
  left: 13px;
  right: 13px;
  bottom: 10px;
  display: flex;
  gap: 7px;
}
.drag-bars i {
  display: block;
  width: 45%;
  height: 10px;
  background: #d5aedf;
  border: 1px solid #9f719f;
}
.drag-bars i:nth-child(2) {
  width: 25%;
  background: #efadca;
}
.drag-bars i:nth-child(3) {
  width: 15%;
  background: #f0ce89;
}
.component-library {
  position: absolute;
  left: 210px;
  top: 700px;
  width: 660px;
  height: 640px;
  border: 5px solid #583954;
  background: #edbcd3;
  border-radius: 12px;
  box-shadow: 13px 15px #583954;
}
.library-tab {
  position: absolute;
  left: -5px;
  top: -62px;
  width: 320px;
  height: 62px;
  border: 5px solid #583954;
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  background: #f6d3e1;
  padding: 12px 22px;
  font: 30px sans-serif;
}
.library-rim {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 60px;
  padding: 12px 24px;
  background: #f6d3e1;
  border-bottom: 3px solid #b885a6;
}
.library-rim i {
  width: 14px;
  height: 14px;
  border: 2px solid #9e668c;
  background: #fff0d3;
}
.library-rim b {
  margin-left: auto;
  font: 18px monospace;
  color: #a26b8c;
}
.library-slots {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 35px;
  padding: 33px 27px;
}
.library-slots i {
  height: 223px;
  border: 3px dashed #be91aa;
  border-radius: 8px;
  background: #fff0f6;
}
.new-creator {
  position: absolute;
  top: 740px;
  width: 300px;
  height: 534px;
  border: 4px solid #583954;
  border-radius: 10px;
  box-shadow: 9px 11px #583954;
  overflow: hidden;
}
.creator-0 {
  left: 60px;
}
.creator-1 {
  left: 390px;
}
.creator-2 {
  left: 720px;
}
.variant-trio {
  position: absolute;
  left: 25px;
  top: 755px;
  width: 1030px;
  height: 600px;
  perspective: 1500px;
}
.trio-card {
  position: absolute;
  top: 0;
  width: 330px;
  height: 586.6667px;
  border: 4px solid #583954;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 9px 12px #583954;
  background: #fff3fa;
  transform-origin: center;
}
.trio-card > div {
  position: absolute;
  inset: 0;
}
.trio-card video {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.card-0 {
  left: 0;
}
.card-1 {
  left: 350px;
}
.card-2 {
  left: 700px;
}
`;
