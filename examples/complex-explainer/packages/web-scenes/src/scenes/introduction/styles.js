export const intro_styles = `.phase.gallery {
  overflow: visible;
}
.card {
  position: absolute;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.card-0 {
  left: 0;
  top: 75px;
  width: 362px;
  height: 645px;
  z-index: 1;
  transform-origin: left center;
}
.card-1 {
  right: 0;
  top: 75px;
  width: 362px;
  height: 645px;
  z-index: 1;
  transform-origin: right center;
}
.card-2 {
  left: 319px;
  top: 0;
  width: 442px;
  height: 786px;
  z-index: 2;
}
.original,
.target {
  position: absolute;
  inset: 0;
}
.original > *,
.target > * {
  object-fit: cover !important;
}
.target {
  opacity: 0;
}
.app {
  position: absolute;
  top: 330px;
  width: 255px;
  height: 255px;
  opacity: 0;
  filter: drop-shadow(0 12px 20px #0008);
}
.app-codex {
  left: 170px;
  filter: drop-shadow(0 0 8px #effcff) drop-shadow(0 0 32px #bbddff99);
}
.app-claude {
  right: 170px;
  filter: drop-shadow(0 0 8px #ffb89b) drop-shadow(0 0 32px #df775eaa);
}
.original,
.target {
  backface-visibility: hidden;
  transform-origin: center center;
}
.swap-sweep {
  position: absolute;
  inset: -10% -20%;
  background: linear-gradient(
    110deg,
    transparent 35%,
    #fff5dcaa 48%,
    #e83f5fcc 51%,
    transparent 65%
  );
  opacity: 0;
  pointer-events: none;
  mix-blend-mode: screen;
}
.gallery {
  perspective: 1800px;
}
.card {
  will-change: transform;
  isolation: isolate;
}
.terminal {
  background: #fff0f7;
  border: 0;
}
.terminal-bar {
  height: 65px;
  border-bottom: 4px solid #392738;
  display: flex;
  align-items: center;
  padding: 0 25px;
  gap: 14px;
  background: #f8add0;
}
.terminal-bar i {
  width: 16px;
  height: 16px;
  background: #ef73ae;
  border-radius: 2px;
}
.terminal-bar i:nth-child(2) {
  background: #e7c574;
}
.terminal-bar i:nth-child(3) {
  background: #80ba91;
}
.terminal-bar span {
  font: 28px monospace;
  color: #392738;
  margin-left: 230px;
}
.terminal pre {
  font:
    29px/1.55 Menlo,
    monospace;
  color: #68394f;
  white-space: pre-wrap;
  margin: 28px 35px;
  max-height: 650px;
  overflow: hidden;
}
.cursor {
  position: absolute;
  right: 40px;
  bottom: 35px;
  width: 15px;
  height: 30px;
  background: #d95791;
}
`;
