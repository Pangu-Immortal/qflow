import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryResourceStore } from "@qflow/driver-node";
import { sealComposition, sealVisualTrack } from "@qflow/composition";
import { compileHyperframesDocument } from "@qflow/hyperframes";
import { appendPerformanceUse, resolvePerformance } from "@qflow/performance";
import { timelineFixture } from "../../../test/timeline-fixture.js";
import { projectProgramWindow } from "../../../test/temporal-fixture.js";
import { movingFrame, crossfade } from "../../../examples/semantic-composition/packages/performance-styles/src/render.js";
import { renderHyperframesVisual } from "../src/index.js";

test("project Performance Styles render movement, empty override, resumed playback, tail and two-source blending", {
  skip: process.env.QFLOW_BROWSER_TESTS !== "1",
}, async () => {
  const root=await mkdtemp(join(tmpdir(),"qflow-performance-"));
  try {
    const resources=new MemoryResourceStore();
    const makeVideo=async(name:string,color:number[])=>{
      const path=join(root,`${name}.mp4`);
      const raw=Buffer.from(Array.from({length:8*64*64},()=>color).flat());
      const result=spawnSync("ffmpeg",["-v","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s","64x64","-r","30","-i","pipe:0","-c:v","libx264","-crf","0","-pix_fmt","yuv420p",path],{input:raw});
      if(result.error)throw result.error;
      assert.equal(result.status,0,result.stderr?.toString());
      return resources.put(await readFile(path),"video/mp4");
    };
    const a=await makeVideo("red",[220,20,20]),b=await makeVideo("blue",[20,20,220]);
    const fixture=timelineFixture({id:"film",durationSec:16/30,frameRate:{numerator:30,denominator:1}},{segments:[{id:"a",frameCount:8},{id:"b",frameCount:8}]});
    const timeline={...fixture,durationSec:14/30,items:fixture.items.map((item,i)=>({...item,startFrame:i*4,take:{...item.take,media:{timeline:item.take.media.timeline,visual:{artifact:i===0?a:b,width:64,height:64}}}}))};
    const window=(id:string,start:number,end:number)=>projectProgramWindow({itemId:id,semantic:timeline,projection:{start:{ref:"absolute",at:{unit:"frames",value:start}},end:{ref:"absolute",at:{unit:"frames",value:end}}}});
    const full={xPx:0,yPx:0,widthPx:64,heightPx:64},side={...full,xPx:32,widthPx:32};
    const base=window("base",0,14),settled=window("side",4,14),move=window("move",4,8),hide=window("hide",8,9);
    let set=appendPerformanceUse({uses:[]},base,movingFrame(timeline,base,full,full));
    set=appendPerformanceUse(set,settled,movingFrame(timeline,settled,side,side));
    set=appendPerformanceUse(set,move,movingFrame(timeline,move,full,side));
    set=appendPerformanceUse(set,hide,sealVisualTrack({id:"hidden",programSpaceId:timeline.id,visualIr:"qflow.visual-ir@1",presents:[]}));
    const render=async(name:string,track:ReturnType<typeof resolvePerformance>)=>{
      const document=compileHyperframesDocument(sealComposition({id:name,canvas:{width:64,height:64,clearColor:"#000000"},tracks:[track]}),timeline);
      const video=await renderHyperframesVisual({document},{resources,workers:1,quality:"high",processTimeoutMs:120000});
      const file=join(root,`${name}.mp4`);await writeFile(file,(await resources.get(video.artifact.resource))!);
      const decoded=spawnSync("ffmpeg",["-v","error","-i",file,"-f","rawvideo","-pix_fmt","rgb24","pipe:1"]);
      if(decoded.error)throw decoded.error;
      assert.equal(decoded.status,0,decoded.stderr?.toString());return decoded.stdout;
    };
    const pixels=await render("move",resolvePerformance(timeline,"presenter",set));
    const pixel=(data:Buffer,f:number,x:number)=>[...data.subarray((f*64*64+32*64+x)*3,(f*64*64+32*64+x)*3+3)];
    assert.ok(pixel(pixels,2,16)[0]!>170,"initial full frame");
    assert.ok(pixel(pixels,7,16).every(c=>c<25),"moving view reaches right side");
    assert.ok(pixel(pixels,7,48)[2]!>170,"incoming footage remains visible");
    assert.ok(pixel(pixels,8,48).every(c=>c<25),"empty Use suppresses underlying rules");
    assert.ok(pixel(pixels,9,48)[2]!>170,"settled view resumes");
    assert.ok(pixel(pixels,12,48).every(c=>c<25),"tail requires no fabricated clip");
    const excerpt=(id:string)=>({kind:"segment" as const,narrativeId:fixture.narrativeId,id,tokenStart:0,tokenEndExclusive:0});
    const mix=crossfade(timeline,move,excerpt("a"),excerpt("b"),full);
    const blended=await render("mix",mix);
    assert.ok(pixel(blended,4,32)[0]!>170,"outgoing endpoint");
    assert.ok(pixel(blended,7,32)[2]!>170,"incoming endpoint");
    assert.ok(pixel(blended,5,32)[0]!>90 && pixel(blended,5,32)[2]!>40,"both sources contribute inside overlap");
  } finally { await rm(root,{recursive:true,force:true}); }
});
