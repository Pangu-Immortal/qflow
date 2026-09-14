// Shared pixel-art flag: a small texture, stepped folds and two authored views.
// Every frame is determined by its time; no simulation history is needed.
export const flagSetup = String.raw`
const flagCanvas=root.querySelector('.flag-canvas'), ctx=flagCanvas.getContext('2d');
flagCanvas.width=256;flagCanvas.height=160;ctx.imageSmoothingEnabled=false;
const logo=root.querySelector('.logo-resource img');
const texture=document.createElement('canvas');texture.width=128;texture.height=52;
const tc=texture.getContext('2d');tc.imageSmoothingEnabled=false;
const flagRaster=document.createElement('canvas');flagRaster.width=256;flagRaster.height=160;
const cc=flagRaster.getContext('2d');cc.imageSmoothingEnabled=false;
const mask=document.createElement('canvas');mask.width=256;mask.height=160;
const mc=mask.getContext('2d');let pixels=null;
function prepareTexture(){
 if(!logo?.complete||!logo.naturalWidth)return false;
 tc.fillStyle=data.flagColor;tc.fillRect(0,0,128,52);
 const lw=110,lh=Math.round(lw*logo.naturalHeight/logo.naturalWidth);
 tc.drawImage(logo,9,Math.round((52-lh)/2),lw,lh);
 // A few stitched pixels frame the logo without covering its lettering.
 tc.fillStyle='#ffe8f4';for(let x=4;x<124;x+=5){tc.fillRect(x,2,2,1);tc.fillRect(x,49,2,1);}
 pixels=tc.getImageData(0,0,128,52).data;return true;
}
function drawFlag(frame){
 if(!pixels&&!prepareTexture())return;
 const floor=data.flagPose==='floor',t=Math.floor(frame/data.fps*12)/12;
 const phase=t*data.flagSpeed*Math.PI*2,amp=Math.min(7,data.flagAmplitude*60);
 cc.clearRect(0,0,256,160);ctx.clearRect(0,0,256,160);
 for(let y=0;y<52;y++)for(let x=0;x<128;x++){
  const u=x/127,v=y/51,p=7*u-2*v-phase;
  const wave=Math.sin(p)+.2*Math.sin(p*1.8+.7);
  const dy=Math.round(amp*wave*(floor?1:Math.pow(u,.75)));
  const width=floor?142+v*65:190;
  const px=Math.round((floor?128-width/2-5*v:37)+u*width);
  const py=Math.round((floor?58+v*40:35+v*73+u*9)+dy);
  const band=Math.cos(p-0.45),shade=band>.5?1.1:band<-.55?.76:band<-.05?.9:1;
  const i=(y*128+x)*4;
  cc.fillStyle='rgb('+Math.min(255,Math.round(pixels[i]*shade))+','+Math.min(255,Math.round(pixels[i+1]*shade))+','+Math.min(255,Math.round(pixels[i+2]*shade))+')';
  cc.fillRect(px,py,Math.ceil(width/127)+1,floor?2:3);
 }
 mc.clearRect(0,0,256,160);mc.drawImage(flagRaster,0,0);mc.globalCompositeOperation='source-in';mc.fillStyle='#42263e';mc.fillRect(0,0,256,160);mc.globalCompositeOperation='source-over';
 if(!floor){ctx.fillStyle='#281d2d';ctx.fillRect(32,22,4,121);ctx.fillRect(30,18,8,6);ctx.fillStyle='#ffe6b3';ctx.fillRect(31,18,5,4);ctx.fillStyle='#faafd1';ctx.fillRect(33,25,1,113);}
 ctx.drawImage(mask,3,4);
 for(const [x,y] of [[-1,0],[1,0],[0,-1],[0,1]])ctx.drawImage(mask,x,y);
 ctx.drawImage(flagRaster,0,0);
}
`;
