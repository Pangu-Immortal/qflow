import assert from "node:assert/strict";
import test from "node:test";
import { assertAudioTrackIdentity, sealAudioTrack, audioEnvelopeGainAt, sealComposition } from "@qflow/composition";
import { compileAudioProgramPlan, verifyAudioProgramPlan } from "@qflow/media-pipeline";
import { ordinarySound, sourceSound, appendSoundUse, resolveSound, soundStyle, soundTypes, decodeSoundTrackSurface } from "../src/index.js";
import { timelineFixture } from "../../../test/timeline-fixture.js";
import { projectProgramWindow } from "../../../test/temporal-fixture.js";
import type { Timeline } from "@qflow/timeline";
import { timelineTypes } from "@qflow/timeline";
import type { NarrativeExcerpt } from "@qflow/narrative";
import { narrativeTypes } from "@qflow/narrative";
import type { StructuredElement, SurfaceResolvedReference } from "@qflow/markup";
import { canonicalize } from "@qflow/protocol";
import { sealGraphFragment } from "@qflow/elaborator";
import { compositionTypes } from "@qflow/composition";
import { temporalTypes } from "@qflow/temporal";
import { crossfadeSound } from "../../../examples/semantic-composition/packages/sound-styles/src/render.js";

const clock = { id: "film", durationSec: 6, frameRate: { numerator: 30, denominator: 1 } };
const base = timelineFixture(clock, { segments: [{ id: "a", frameCount: 90 }, { id: "b", frameCount: 90 }] });
const timeline: Timeline = { ...base, items: base.items.map((item,index)=>({...item,startFrame:index===0 ? 15:60})) };
const window = (id: string, start: number, end: number, source=timeline) => projectProgramWindow({ itemId: id, semantic: source,
  projection: { start: { ref: "absolute", at: { unit: "frames", value: start } }, end: { ref: "absolute", at: { unit: "frames", value: end } } } });
const segment = (id:string):NarrativeExcerpt => ({kind:"segment",narrativeId:base.narrativeId,id,tokenStart:0,tokenEndExclusive:0});
const at = (frame:number)=>frame*1600;

test("ordinary sound chooses the last declared active audio source, with gaps and absence intact",()=>{
  const sound=ordinarySound(timeline,window("base",0,180));
  assertAudioTrackIdentity(sound,timeline);
  assert.deepEqual(sound.clips.map(c=>[c.id,c.audibility]),[
    ["a",[{startSample:at(15),endSampleExclusive:at(60)}]],
    ["b",[{startSample:at(60),endSampleExclusive:at(150)}]],
  ]);
  assert.deepEqual(sound.clips.map(c=>c.source.startSample),[0,0]);
  const reverse={...timeline,items:[timeline.items[1]!,timeline.items[0]!]};
  const reversed=ordinarySound(reverse,window("base",0,180,reverse));
  assert.deepEqual(reversed.clips.find(c=>c.id==="b")!.audibility,[{startSample:at(105),endSampleExclusive:at(150)}]);
  const noAudio={...timeline,items:timeline.items.map((item,index)=> index===0?item:{...item,take:{...item.take,media:{timeline:item.take.media.timeline,visual:{artifact:{kind:"blob" as const,resource:"res_visual" as const,size:1,mediaType:"video/mp4"},width:64,height:64}}}})};
  assert.deepEqual(ordinarySound(noAudio,window("base",0,180,noAudio)).clips[0]!.audibility,[{startSample:at(15),endSampleExclusive:at(105)}]);
  const empty={...clock,items:[]};
  assert.equal(ordinarySound(empty,window("empty",0,180,empty)).clips.length,0);
});

test("Use silence and later restoration preserve original playback and fade progress",()=>{
  const broad=window("broad",0,180), fade=window("fade",15,150), hidden=window("hidden",45,75), restore=window("restore",60,65);
  let set=appendSoundUse({uses:[]},broad,ordinarySound(timeline,broad));
  set=appendSoundUse(set,fade,ordinarySound(timeline,fade,{gain:0,endGain:1}));
  set=appendSoundUse(set,hidden,ordinarySound(timeline,hidden,{gain:0,endGain:0}));
  set=appendSoundUse(set,restore,ordinarySound(timeline,restore));
  const result=resolveSound(timeline,"voice",set);
  const resumed=result.clips.find(c=>c.id==="2:b")!;
  assert.deepEqual(resumed.target,{startSample:at(60),endSampleExclusive:at(150)});
  assert.equal(resumed.source.startSample,0);
  assert.deepEqual(resumed.audibility,[{startSample:at(75),endSampleExclusive:at(150)}]);
  assert.equal(audioEnvelopeGainAt(resumed.gainEnvelope,at(75)),60/135);
  assert.deepEqual(result.clips.find(c=>c.id==="4:b")!.audibility,[{startSample:at(60),endSampleExclusive:at(65)}]);
  const plan=compileAudioProgramPlan(sealComposition({id:"film",canvas:{width:64,height:64,clearColor:"#000000"},tracks:[result]}),timeline);
  verifyAudioProgramPlan(plan);
  assert.deepEqual(plan.clips.find(c=>c.id==="voice:2:b")!.gainEnvelope,resumed.gainEnvelope);
  assert.deepEqual(plan.clips.find(c=>c.id==="voice:2:b")!.audibility,resumed.audibility);
  assert.equal(resolveSound(timeline,"silent",{uses:[]}).clips.length,0);
});

test("a project crossfade binds source roles independently from its physical Window",()=>{
  const span=window("mix",60,105);
  const mixed=crossfadeSound(timeline,span,segment("a"),segment("b"));
  assertAudioTrackIdentity(mixed,timeline);
  assert.deepEqual(mixed.clips.map(c=>c.id),["a","b"]);
  for(const c of mixed.clips) assert.equal(audioEnvelopeGainAt(c.gainEnvelope,at(82.5)),0.5);
  assert.equal(mixed.clips.find(c=>c.id==="a")!.target.startSample,at(15));
  const swapped=crossfadeSound(timeline,span,segment("b"),segment("a"));
  assert.equal(audioEnvelopeGainAt(swapped.clips.find(c=>c.id==="a")!.gainEnvelope,at(60)),0);
  const missingSound={...timeline,items:timeline.items.map((item,index)=>index===0?item:{...item,take:{...item.take,media:{timeline:item.take.media.timeline,visual:{artifact:{kind:"blob" as const,resource:"res_visual" as const,size:1,mediaType:"video/mp4"},width:64,height:64}}}})};
  assert.equal(crossfadeSound(missingSound,window("mix",60,105,missingSound),segment("a"),segment("b")).clips.length,1);
  assert.throws(()=>sourceSound(timeline,span,segment("unknown")),/Unknown/);
  assert.throws(()=>sourceSound(timeline,span,{...segment("a"),narrativeId:"other"}),/Narrative/);
  assert.throws(()=>crossfadeSound(timeline,span,segment("a"),segment("a")),/distinct/);
});

test("Sound Style bindings expand as graph edges and broad Use needs no selector",async()=>{
  const common=[{name:"timeline",type:timelineTypes.track},{name:"window",type:temporalTypes.window}];
  const extra=[{name:"outgoing",type:narrativeTypes.excerpt},{name:"incoming",type:narrativeTypes.excerpt}];
  const fragment=sealGraphFragment({inputs:[...common,...extra],operations:[{id:"render",producer:{module:{name:"@example/test",version:"1"},name:"mix"},inputs:Object.fromEntries([...common,...extra].map(p=>[p.name,{kind:"fragment-input" as const,name:p.name}])),result:{kind:"output",name:"audio"}}],exports:[{name:"audio",type:compositionTypes.audioTrack,root:{kind:"fragment-operation",operation:"render"}}]});
  const ref=(id:string,type:SurfaceResolvedReference["type"]):SurfaceResolvedReference=>({path:id,type,ref:{kind:"record",id}});
  const bindings={outgoing:ref("outgoing",narrativeTypes.excerpt),incoming:ref("incoming",narrativeTypes.excerpt)};
  const style=soundStyle(fragment,bindings);
  const refs=new Map<string,SurfaceResolvedReference>([["timeline",ref("timeline",timelineTypes.track)],["style",{...ref("style",soundTypes.style),record:{id:"style",type:soundTypes.style,value:{kind:"inline",value:canonicalize(style)}}}]]);
  const range={source:"test.svml",start:0,end:1};
  const root:StructuredElement={kind:"element",name:"sound:Track",attributes:{id:"voice",timeline:{kind:"reference",path:"timeline"}},range,children:[{kind:"element",name:"sound:Use",attributes:{style:{kind:"reference",path:"style"}},children:[],range}]};
  const result=await decodeSoundTrackSurface({element:root,sourceName:"test.svml",resolveReference:path=>refs.get(path),resolveAsset:async()=>{throw new Error("unexpected");}});
  assert.deepEqual(result.components.find(c=>c.id==="voice.use.1.__style")!.inputs.outgoing,bindings.outgoing.ref);
  assert.deepEqual(result.components.at(-1)!.outputs,{audio:"voice.audio",program:"voice.program"});
  assert.throws(()=>soundStyle(fragment,{...bindings,window:ref("window",temporalTypes.window)}),/supplies window/);
});
