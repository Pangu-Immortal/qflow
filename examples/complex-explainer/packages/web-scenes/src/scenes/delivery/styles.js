// This scene owns its fixed design. External events arrive as projected frames.
export const css = `
.delivery-studio {
  top: 670px;
  height: 750px;
  transform-origin: 50% 50%;
}
.asset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 12px;
  padding: 24px 12px;
}
.asset-thumb {
  height: 170px;
  position: relative;
  text-align: center;
}
.asset-picture {
  height: 125px;
}
.asset-picture img {
  height: 100% !important;
  width: 100% !important;
  object-fit: contain !important;
}
.asset-thumb > span {
  display: block;
  font: 15px monospace;
  margin-top: 10px;
}
.pixel-loading {
  position: absolute;
  top: 29px;
  left: 28px;
  display: grid;
  grid-template-columns: repeat(3, 12px);
  gap: 7px;
}
.pixel-loading i {
  width: 12px;
  height: 12px;
  background: #d084b6;
}
.asset-progress {
  height: 5px;
  margin: 6px 8px;
  background: #e1cad9;
}
.asset-progress i {
  height: 100%;
  display: block;
  background: #b478a5;
}
.studio-film {
  position: absolute;
  left: 391px;
  top: 90px;
  width: 252px;
  height: 448px;
  overflow: hidden;
  border: 3px solid #95708b;
}
.studio-film > * {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.phone {
  position: absolute;
  left: 0;
  top: 0;
  width: 420px;
  height: 875px;
  background: linear-gradient(
    115deg,
    #e9e5e7 0%,
    #a9a4ab 18%,
    #ddd9df 48%,
    #8a858e 80%,
    #ddd8df 100%
  );
  border: 2px solid #77717b;
  border-radius: 65px;
  box-shadow:
    inset 0 0 0 3px #eeeaf0,
    inset 0 0 0 8px #171619,
    10px 15px 0 #58395424,
    0 18px 35px #38253526;
  transform-origin: top left;
  overflow: visible;
  box-sizing: border-box;
}
.phone-camera {
  position: absolute;
  top: 26px;
  left: 150px;
  width: 120px;
  height: 33px;
  background: #070709;
  border-radius: 22px;
  z-index: 12;
  box-shadow: inset 0 1px 1px #ffffff13;
}
.phone-camera:after {
  content: "";
  position: absolute;
  right: 10px;
  top: 10px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 40% 35%,
    #24374d,
    #0b1020 45%,
    #09090c 70%
  );
  border: 1px solid #1d1c25;
}
.phone:before,
.phone:after {
  content: "";
  position: absolute;
  width: 4px;
  background: linear-gradient(90deg, #8c8791, #dcd8df, #8c8791);
  border-radius: 2px;
}
.phone:before {
  left: -5px;
  top: 160px;
  height: 57px;
  box-shadow: 0 73px #aaa4ad;
}
.phone:after {
  right: -5px;
  top: 208px;
  height: 95px;
}
.phone-screen {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 10px;
  bottom: 10px;
  border-radius: 54px;
  background: #18121b;
  overflow: hidden;
}
.phone-post {
  position: absolute;
  inset: 0;
}
.phone-post video,
.phone-post img {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  object-position: center top !important;
}
.phone-home {
  position: absolute;
  bottom: 23px;
  left: 140px;
  width: 140px;
  height: 5px;
  background: #fffafc;
  border-radius: 4px;
  z-index: 12;
  box-shadow: 0 1px 3px #0005;
}
.phone-social {
  position: absolute;
  right: 13px;
  bottom: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 19px;
  color: #fff8f8;
  text-align: center;
  filter: drop-shadow(2px 3px #382535);
  z-index: 5;
}
.phone-social > b {
  font: 39px sans-serif;
  line-height: 1;
}
.phone-social small {
  display: block;
  font: 17px monospace;
  margin-top: 5px;
}
.avatar-dot {
  border: 2px solid #fff;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  padding: 6px;
  background: #fff4fa;
}
.avatar-dot svg {
  width: 100%;
  height: 100%;
}
.phone-bottom {
  position: absolute;
  bottom: 39px;
  left: 12px;
  font: 15px monospace;
  color: #fff;
  text-shadow: 2px 2px #382535;
  z-index: 5;
}
.phone-brand {
  position: absolute;
  left: 14px;
  top: 61px;
  height: 42px;
  background: #ffdf99;
  border: 2px solid #774e56;
  padding: 5px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #503740;
  font: 22px monospace;
  z-index: 4;
}
.phone-brand svg {
  width: 30px;
  height: 25px;
}
.floating-hearts {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}
.floating-hearts i {
  position: absolute;
  right: 35px;
  top: 0;
  font: 34px sans-serif;
  color: #ff77ac;
  text-shadow: 2px 3px #824663;
}
.phone-question {
  position: absolute;
  left: 165px;
  top: 145px;
  color: #fff0cf;
  font: bold 85px monospace;
  text-shadow: 5px 6px #614953;
}
`;
