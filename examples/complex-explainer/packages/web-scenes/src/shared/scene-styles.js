export const scene_styles = `:scope {
  pointer-events: none;
  color: #fff1d2;
  overflow: hidden;
  background: #fce5ee;
}
.backdrop {
  position: absolute;
  inset: -12%;
  filter: blur(24px) brightness(0.32);
  transform: scale(1.12);
  overflow: hidden;
}
.backdrop-pane {
  position: absolute;
  top: 0;
  bottom: 0;
  opacity: 0;
  overflow: hidden;
}
.backdrop-pane > * {
  object-fit: cover !important;
}
.backdrop-wash {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    #6d375625 0%,
    #6d375615 50%,
    #47253bc9 100%
  );
}
.font-resource {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}
.heading {
  display: none;
  position: absolute;
  left: 27%;
  top: 18.8%;
  width: 44%;
  text-align: center;
  z-index: 4;
}
.heading b {
  display: block;
  font-size: 100px;
  line-height: 1.1;
  background: linear-gradient(
    175deg,
    #fff8dd 3%,
    #d4b088 37%,
    #fff1c7 49%,
    #755041 52%,
    #d7b68a 86%,
    #fff0cf
  );
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  -webkit-text-stroke: 1px #e9c9a4;
  filter: drop-shadow(0 3px 1px #35211a) drop-shadow(0 0 12px #dfae6440);
}
.heading small {
  display: block;
  font-size: 31px;
  letter-spacing: 2px;
  margin-top: 30px;
  color: #ecd9b6;
}
.stage {
  position: absolute;
  left: 0;
  right: 0;
  top: 565px;
  height: 770px;
}
.phase {
  position: absolute;
  inset: 0;
  opacity: 0;
  overflow: hidden;
}
.screen {
  position: absolute;
  inset: 0;
  background: transparent;
  overflow: hidden;
}
.screen > * {
  object-fit: cover !important;
}
.line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, #deb79c11, #e5c292aa, #deb79c11);
}
.mesh {
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(#fff 0 25%, transparent 0 50%);
  background-size: 8px 8px;
  opacity: 0.018;
}
`;
