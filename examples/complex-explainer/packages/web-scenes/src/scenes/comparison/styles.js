export const comparison_styles = `.heading b {
  font-size: 80px;
}
.panel {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  background: transparent;
  overflow: hidden;
}
.panel-a {
  left: 0;
}
.panel-b {
  right: 0;
}
.panel > * {
  object-fit: cover !important;
  object-position: center top !important;
}
.phase[data-p="case"] .panel {
  background: none;
  border: 0;
  box-shadow: none;
}
.phase[data-p="case"] .panel-a > * {
  object-position: center top !important;
}
.phase[data-p="case"] .panel-b > * {
  object-position: center top !important;
}
.phase[data-p="price"] {
  height: 610px;
}
.phase[data-p="templates"] .panel > * {
  object-fit: cover !important;
}
.phase[data-p="price"] .panel > * {
  object-fit: cover !important;
  object-position: 50% 0 !important;
}
.brand-label {
  position: absolute;
  top: 1370px;
  width: 49%;
  text-align: center;
  font-size: 58px;
  color: #fff2f9;
  -webkit-text-stroke: 2px #281d2d;
  paint-order: stroke fill;
  text-shadow: 5px 6px 0 #281d2d;
  opacity: 0;
}
.label-a {
  left: 0;
}
.label-b {
  right: 0;
}
.brand-label span {
  display: block;
  font: bold 56px/1.2 Menlo, "Courier New", monospace;
  color: #e96aa3;
  -webkit-text-stroke: 2px #281d2d;
  paint-order: stroke fill;
  text-shadow: 3px 4px 0 #281d2d;
  margin-top: 26px;
}
.stamps {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.stamp {
  position: absolute;
  width: 16.2%;
  height: 21%;
  display: flex;
  align-items: center;
  opacity: 0;
  filter: drop-shadow(0 2px 2px #000);
  transform: rotate(-18deg);
}
.stamp > * {
  object-fit: contain !important;
}
`;
