// Final pink treatment; layout and paint for the materials part of the scene.
export const materialsStyles = `.folder {
  position: absolute;
  left: 60px;
  top: 40px;
  width: 900px;
  transform-style: preserve-3d;
  transform-origin: center bottom;
  height: 530px;
}
.folder-tab {
  position: absolute;
  left: 25px;
  top: -22px;
  width: 240px;
  height: 64px;
  padding: 12px 35px;
  font: 22px monospace;
  letter-spacing: 5px;
  background: var(--pink);
  border: 3px solid var(--ink);
  border-bottom: 0;
  border-radius: 8px 12px 0 0;
  color: var(--ink);
  box-shadow: 5px 0 0 var(--ink);
}
.folder-face {
  position: absolute;
  inset: 20px 0 0;
  background: #ffe9f2;
  border: 4px solid var(--ink);
  border-radius: 10px;
  box-shadow: 10px 12px 0 var(--ink);
  padding: 25px 28px;
}
.folder-label {
  align-items: center;
  justify-content: space-between;
  display: none;
}
.folder-label b {
  font-size: 36px;
}
.folder-label small {
  font: 15px monospace;
  color: #9ab0b8;
  letter-spacing: 3px;
}
.assets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 0;
  gap: 20px;
  height: 100%;
  grid-template-rows: 1fr 1fr;
}
.asset {
  opacity: 0;
  height: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.asset > div {
  overflow: hidden;
  height: auto;
  flex: 1;
  min-height: 0;
  border-radius: 6px;
  border: 3px solid var(--ink);
  box-shadow: 4px 4px 0 var(--ink);
}
.asset > div > * {
  object-fit: cover !important;
}
.asset small {
  font: 12px monospace;
  letter-spacing: 2px;
  display: block;
  color: #5b3652;
  font-weight: bold;
  margin-top: 10px;
}
.drag-tile {
  position: absolute;
  width: 140px;
  height: 140px;
  overflow: hidden;
  opacity: 0;
  z-index: 6;
  border: 3px solid var(--ink);
  border-radius: 6px;
  box-shadow: 7px 7px 0 var(--ink);
}
.drag-tile > * {
  object-fit: cover !important;
}
.motion-examples {
  position: absolute;
  inset: 70px 0 0;
  display: flex;
  gap: 30px;
}
.number-example {
  position: relative;
  width: 495px;
  height: 390px;
  overflow: hidden;
  background: var(--cream);
  border: 4px solid var(--ink);
  border-radius: 10px;
  box-shadow: 9px 10px 0 var(--ink);
}
.image-example {
  position: relative;
  width: 495px;
  height: 390px;
  overflow: hidden;
  background: var(--cream);
  border: 4px solid var(--ink);
  border-radius: 10px;
  box-shadow: 9px 10px 0 var(--ink);
}
.motion-examples small {
  position: absolute;
  top: 25px;
  left: 30px;
  font: 17px monospace;
  color: #8cbac9;
  letter-spacing: 4px;
  display: none;
}
.number-example > b {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 64px;
  line-height: 1.1;
  font-family: Menlo, monospace;
  color: var(--ink);
}
.number-example em {
  font-style: normal;
  font-size: 145px;
  color: #f466aa;
  text-shadow: 5px 5px 0 var(--ink);
}
.flying-logo {
  position: absolute;
  left: 78px;
  top: 144px;
  width: 330px;
  height: 101px;
  filter: drop-shadow(4px 5px 0 #f59bca);
}



.logo-burst {position:absolute;left:62px;top:101px;width:365px;height:188px;pointer-events:none;opacity:0}
.logo-burst i {position:absolute;width:24px;height:24px;border:0 solid var(--pink);filter:drop-shadow(3px 3px 0 var(--ink))}
.logo-burst i:nth-child(1){left:0;top:0;border-left-width:6px;border-top-width:6px}
.logo-burst i:nth-child(2){right:0;top:0;border-right-width:6px;border-top-width:6px;border-color:var(--lilac)}
.logo-burst i:nth-child(3){left:0;bottom:0;border-left-width:6px;border-bottom-width:6px;border-color:var(--lilac)}
.logo-burst i:nth-child(4){right:0;bottom:0;border-right-width:6px;border-bottom-width:6px}
.image-example svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.pulse-ring {
  position: absolute;
  left: 125px;
  top: 100px;
  width: 250px;
  height: 250px;
  border: 1px solid #e83f5f;
  border-radius: 50%;
  opacity: 0;
  border-color: #f46bac;
}
.image-example svg path {
  stroke: #f46bac;
}`;
