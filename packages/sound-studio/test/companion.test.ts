import assert from "node:assert/strict";
import test from "node:test";
import { sealAudioTrack } from "@qflow/composition";
import { temporalTypes } from "@qflow/temporal";
import { timelineTypes } from "@qflow/timeline";
import type { StudioTrackCompanionContext } from "@qflow/studio-adapter";
import { projectSound } from "../src/index.js";
import { timelineFixture } from "../../../test/timeline-fixture.js";
import { projectProgramWindow } from "../../../test/temporal-fixture.js";

const base = timelineFixture({ id: "film", durationSec: 6, frameRate: { numerator: 30, denominator: 1 } }, {
  segments: [{id:"first",frameCount:90},{id:"second",frameCount:90}],
});
function context(audio: boolean): StudioTrackCompanionContext {
  const timeline = {...base, items: base.items.map((item,index)=>({...item,startFrame:index ? 60:15,take:{...item.take,
    media: audio ? item.take.media : {timeline:item.take.media.timeline,visual:{artifact:{kind:"blob",resource:`res_picture${index}`,mediaType:"video/mp4",size:1},width:64,height:64}},
  }}))};
  const program = {uses:["base","override","hidden"].map(id=>({
    window:projectProgramWindow({itemId:id,semantic:base,projection:{start:{ref:"absolute",at:{unit:"frames",value:0}},end:{ref:"absolute",at:{unit:"frames",value:180}}}}),
    audio:sealAudioTrack({id,programSpaceId:base.id,clips:[]}),
  }))};
  return {
    track:{outputRef:"p.audio",trace:{references:[{input:"timeline",typeRef:timelineTypes.track,ref:"film"}],outputPorts:[{name:"program",ref:"p.program"}]}},
    placement:{children:program.uses.map((use,index)=>({range:{start:index*10,end:index*10+5},referenceAttributes:{style:`styles.${use.window.subjectId}`},values:[{type:temporalTypes.windowSpec,value:{id:use.window.subjectId}}]}))},
    values:new Map<string,unknown>([["film",timeline],["p.program",program]]),spans:[],temporalBindings:[],
  } as unknown as StudioTrackCompanionContext;
}

test("Use band keeps fully overridden and silent rules with exact child and Style ownership",()=>{
  const uses=projectSound(context(false));
  assert.deepEqual(uses.map(use=>[use.display.title,use.band,use.elementRange]),[
    ["styles.base","uses",{start:0,end:5}],
    ["styles.override","uses",{start:10,end:15}],
    ["styles.hidden","uses",{start:20,end:25}],
  ]);
  assert.ok(uses.every(use=>use.presentation?.chrome==="standard"));
  assert.ok(uses.every(use=>use.inspector?.[0]?.value === "0–180"));
});

test("content follows audio-only Takes including gaps and overlaps; picture-only contributes no sound",()=>{
  const content=projectSound(context(true)).filter(entity=>entity.band===undefined);
  assert.deepEqual(content.map(entity=>[entity.authoredId,entity.startFrame,entity.endFrameExclusive]),[
    ["first",15,105],["second",60,150],
  ]);
  assert.deepEqual(content[0]?.inspector?.map(field=>field.value), ["first", "15–105"]);
  assert.equal(projectSound(context(false)).filter(entity=>entity.band===undefined).length,0);
});
