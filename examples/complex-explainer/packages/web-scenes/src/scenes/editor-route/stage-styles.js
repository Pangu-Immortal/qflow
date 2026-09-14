import { routeCardsCss } from "../../shared/route-cards.js";
// Final pink treatment; layout and paint for the stage part of the scene.
export const stageStyles = `:scope {
  background: transparent !important;
  font-family: Menlo, "Courier New", monospace !important;
  color: var(--ink);
}
.backdrop {
  display: none;
}
.backdrop-wash {
  display: none;
}
.technical {
  position: absolute;
  inset: 0;
  opacity: 0;
  background: var(--paper);
}
.field {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  opacity: 1;
}
.weave {
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(
    from 45deg,
    #0009 0 25%,
    #a6c4d00c 0 50%
  );
  background-size: 6px 6px;
  display: none;
}
.horizon {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    #02071280,
    transparent 45%,
    #050914dd 87%
  );
  display: none;
}
.homepage {
  position: absolute;
  left: 0;
  top: 922px;
  width: 1080px;
  height: 998px;
  overflow: hidden;
  opacity: 0;
}
.homepage > * {
  object-fit: cover !important;
  object-position: center top !important;
}
.road-heading {
  position: absolute;
  top: 365px;
  left: 300px;
  width: 450px;
  text-align: center;
  opacity: 0;
  display: none;
}
.road-heading small {
  display: block;
  color: #bfd9e2;
  letter-spacing: 8px;
  font: 23px monospace;
  margin-bottom: 20px;
}
.road-heading b {
  font-size: 86px;
  color: #f6e2bf;
  text-shadow: 0 2px 1px #684931,
    0 0 20px #f2c99166;
}
${routeCardsCss}
.demo {
  position: absolute;
  left: 30px;
  top: 565px;
  width: 1020px;
  height: 620px;
  perspective: 1700px;
  z-index: 10;
}
.brands {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-around;
  perspective: 900px;
}
.brand {
  width: 230px;
  height: 230px;
  opacity: 0;
}
.brand > * {
  object-fit: contain !important;
}
.capcut {
  filter: drop-shadow(0 0 5px #e6fcff) drop-shadow(0 0 35px #b5d2eccc);
}
.premiere {
  filter: drop-shadow(0 0 7px #d6bfff) drop-shadow(0 0 40px #9a52fccc);
}
.resolve {
  filter: drop-shadow(0 0 8px #e3e9f2) drop-shadow(0 0 38px #87a9d2aa);
}
.brand-equality {
  position: absolute;
  bottom: 45px;
  width: 100%;
  text-align: center;
  font-size: 53px;
  letter-spacing: 8px;
  color: #e7eef3;
  opacity: 0;
  display: none;
}`;
