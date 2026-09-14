// Final pink treatment; layout and paint for the output part of the scene.
export const outputStyles = `.terminal-top i {
  background: #e46876;
  border-radius: 2px;
  border: 1px solid var(--ink);
  width: 12px;
  height: 12px;
}
.terminal-top i:nth-child(2) {
  background: #e8bd73;
}
.terminal-top i:nth-child(3) {
  background: #71bf98;
}
.terminal-cost {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--cream);
  border: 4px solid var(--ink);
  border-radius: 12px;
  box-shadow: 10px 12px 0 var(--ink);
}
.terminal-top {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 9px;
  background: var(--pinkSoft);
  border-bottom: 3px solid var(--ink);
}
.terminal-top span {
  margin-left: 30px;
  font: 18px monospace;
  letter-spacing: 3px;
  color: var(--ink);
  font-weight: 700;
}
.token-meter {
  position: absolute;
  display: flex;
  gap: 20px;
  bottom: 0;
  left: 0;
  right: 0;
  height: 130px;
  padding: 15px 28px;
  background: var(--pinkSoft);
  border-top: 3px solid var(--ink);
  align-items: center;
}
.token-meter small {
  font: 20px monospace;
  letter-spacing: 5px;
  color: var(--ink);
}
.token-meter b {
  font: bold 98px monospace;
  font-size: 86px;
  color: #e13e8c;
  text-shadow: 2px 3px 0 #fffbfd;
}
.token-meter span {
  font: 72px monospace;
  color: var(--ink);
}
.generated {
  position: absolute;
  inset: 0;
  perspective: 1500px;
}
.sample {
  position: absolute;
  left: 270px;
  top: -30px;
  width: 480px;
  height: 650px;
  border: 5px solid var(--ink);
  border-radius: 10px;
  background: var(--cream);
  box-shadow: 11px 13px 0 var(--ink);
  overflow: hidden;
  transform-origin: 50% 70%;
}
.sample > * {
  object-fit: cover !important;
  object-position: 50% 70% !important;
}
.sample-label {
  position: absolute;
  left: 330px;
  top: 5px;
  font: 15px monospace;
  color: #e6edf5;
  letter-spacing: 3px;
  background: #0008;
  padding: 8px 14px;
  display: none;
}
.variant {
  position: absolute;
  width: 240px;
  height: 215px;
  padding: 16px;
  transform-origin: center center;
  background: #fff7fc;
  border: 4px solid var(--ink);
  border-radius: 10px;
  box-shadow: 7px 8px 0 var(--ink);
}
.v0 {
  left: 0;
  top: 0;
  --accent: #f466aa;
}
.v1 {
  right: 0;
  top: 140px;
  --accent: #c5a3ed;
}
.v2 {
  left: 0;
  bottom: 0;
  --accent: #9fd9b8;
}
.variant small {
  font: 12px monospace;
  letter-spacing: 2px;
  color: var(--accent);
  display: none;
}
.v0 > b {
  display: block;
  font: bold 31px/1.4 monospace;
  color: #df4b95;
}
.v0 b span {
  font: 20px sans-serif;
  margin-left: 15px;
  font-family: monospace;
  color: var(--ink);
}
.podiums {
  display: flex;
  align-items: end;
  height: 105px;
  gap: 10px;
  justify-content: center;
  margin-top: 15px;
}
.podiums b {
  width: 48px;
  height: 65px;
  display: grid;
  place-items: center;
  font: 32px monospace;
  background: #e3d4f8;
  color: var(--ink);
  border: 2px solid var(--ink);
}
.podiums b:nth-child(2) {
  height: 100px;
  background: #bd93e8;
}
.v1 strong {
  font: 21px sans-serif;
  display: block;
  text-align: center;
  margin-top: 8px;
  font-family: monospace;
  color: var(--ink);
}
.v2 strong {
  font: bold 70px sans-serif;
  display: block;
  color: #438368;
  font-family: monospace;
}
.v2 p {
  font: 21px sans-serif;
  margin-top: 15px;
  font-family: monospace;
  color: var(--ink);
}
.v2 em {
  font-style: normal;
  padding: 5px;
  background: #bee7d0;
}
.connectors {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.connectors path {
  fill: none;
  stroke-dasharray: 500;
  stroke: var(--ink);
  stroke-width: 4;
  filter: none;
}
.lock svg {
  width: 36px;
  height: 43px;
}
.lock {
  position: absolute;
  left: 475px;
  top: 280px;
  font: 40px monospace;
  opacity: 0;
  text-shadow: none;
  color: #f66dab;
}
.terminal-cost pre {
  font: 22px/1.45 Menlo,
    monospace;
  color: #58405c;
  white-space: pre;
  height: 400px;
  margin: 12px 0 0;
  padding: 8px 24px;
  mask-image: none;
  overflow: hidden;
  border-left: 8px solid var(--pinkSoft);
}
.lock rect {
  fill: #fff4fa;
  stroke: var(--ink);
}`;
