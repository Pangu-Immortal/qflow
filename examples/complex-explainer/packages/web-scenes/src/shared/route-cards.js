export const routeCardsHtml = `
<div class="routes"
  ><div class="route route-editor"
    ><div class="route-face"
      ><div class="selection-sweep" aria-hidden="true"></div
      ><svg class="route-icon" viewBox="0 0 180 90">
        <g fill="none" stroke="currentColor" stroke-width="3">
          <rect x="4" y="4" width="172" height="82" rx="4" />
          <path d="M4 27H176M25 27V86" />
          <path d="M38 43H105M60 58H150M38 74H122" stroke-width="9" />
          <path d="M117 21V83" stroke="#e83f5f" stroke-width="2" />
        </g></svg
      ><b>剪辑软件</b><div class="route-line"></div></div></div
  ><div class="versus"><span>VS</span></div
  ><div class="route route-code"
    ><div class="route-face"
      ><div class="braces">&lt;/&gt;</div><b>代码</b><div class="route-line"></div></div></div
></div>`;
export const routeCardsCss = `.routes {
  position: absolute;
  left: 50px;
  top: 710px;
  width: 980px;
  height: 390px;
  transform-style: preserve-3d;
  perspective: 1600px;
  transform-origin: center center;
  z-index: 30;
}
.route {
  position: absolute;
  width: 420px;
  height: 350px;
  transform-style: preserve-3d;
}
.route-editor {
  left: 0;
  --rim: #2b1f30;
}
.route-code {
  right: 0;
  --rim: #2b1f30;
}
.route-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 5px solid var(--ink);
  border-radius: 14px;
  background: var(--lilac);
  box-shadow: 12px 14px 0 var(--ink);
}
.route-editor .route-face{overflow:hidden}
.selection-sweep{position:absolute;inset:-15% auto -15% 0;width:110px;pointer-events:none;background:repeating-linear-gradient(0deg,#fff5db99 0 12px,transparent 12px 18px);clip-path:polygon(0 0,65% 0,65% 12%,80% 12%,80% 35%,100% 35%,100% 65%,80% 65%,80% 85%,65% 85%,65% 100%,0 100%);opacity:0}
.route-code .route-face {
  border: 5px solid var(--ink);
  border-radius: 14px;
  background: var(--lilac);
  box-shadow: 12px 14px 0 var(--ink);
}
.route small {
  font: 21px monospace;
  letter-spacing: 5px;
  color: var(--rim);
  position: absolute;
  top: 28px;
}
.route b {
  margin-top: 15px;
  font-family: monospace;
  font-weight: 900;
  font-size: 65px;
  text-shadow: none;
  color: var(--ink);
}
.route-icon {
  width: 185px;
  height: 93px;
  margin-top: 15px;
  color: var(--ink);
}
.braces {
  font: 100px/1.1 monospace;
  margin-top: 15px;
  color: var(--ink);
}
.route-line {
  position: absolute;
  bottom: 20px;
  width: 80%;
  background: var(--ink);
  height: 3px;
}
.versus {
 position:absolute;left:420px;top:0;width:140px;height:350px;
 display:grid;place-items:center;z-index:2;color:var(--ink);
}
.versus span{display:grid;place-items:center;width:96px;height:86px;font:900 38px/1 Menlo,monospace;letter-spacing:-3px;background:#fff5db;border:4px solid var(--ink);border-radius:8px;box-shadow:5px 6px 0 var(--ink);transform:rotate(-3deg)}
.versus::before,.versus::after{content:"";position:absolute;top:164px;border-top:10px solid transparent;border-bottom:10px solid transparent}
.versus::before{left:0;border-left:14px solid var(--ink)}
.versus::after{right:0;border-right:14px solid var(--ink)}
`;
