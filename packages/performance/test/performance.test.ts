import assert from "node:assert/strict";
import test from "node:test";
import { sealVisualTrack, sealComposition } from "@qflow/composition";
import { compileHyperframesDocument } from "@qflow/hyperframes";
import { resolvePerformance, appendPerformanceUse, ordinaryPerformance, performanceStyle, decodePerformanceTrackSurface } from "../src/index.js";
import { timelineFixture } from "../../../test/timeline-fixture.js";
import { projectProgramWindow } from "../../../test/temporal-fixture.js";
import { decodeMediaItemSpec, decodeMediaSampleSpec, decodeMediaFit } from "@qflow/media-track";
import type { Timeline } from "@qflow/timeline";
import type { StructuredElement, SurfaceResolvedReference } from "@qflow/markup";
import { timelineTypes } from "@qflow/timeline";
import { spatialTypes } from "@qflow/spatial";
import { performanceTypes } from "../src/manifest.js";
import { ordinaryPerformanceFragment } from "../src/surface.js";
import { mediaTrackTypes } from "@qflow/media-track";
import { canonicalize } from "@qflow/protocol";
import { movingFrame, crossfade } from "../../../examples/semantic-composition/packages/performance-styles/src/render.js";

const timeline: Timeline = { id: "film", durationSec: 6, frameRate: { numerator: 30, denominator: 1 }, items: [] };
const window = (id: string,start: number,end: number, source=timeline) => projectProgramWindow({ itemId: id, semantic: source,
  projection: { start: { ref: "absolute", at: { unit: "frames", value: start } }, end: { ref: "absolute", at: { unit: "frames", value: end } } } });
const picture = (id: string,start=0,end=180) => sealVisualTrack({ id, visualIr: "qflow.visual-ir@1",programSpaceId: timeline.id,
  presents: [{ id,span: {startFrame:start,endFrameExclusive:end},stacking: {order:0,tieBreak:id},elements:[{id:"root",kind:"box",order:0,style:[{name:"background",value:"red"}]}] }] });
const canvas = { widthPx: 64,heightPx:64, origin: "top-left", xDirection: "right", yDirection: "down", pixelAspect: "square" } as const;
const frame = {xPx:0,yPx:0,widthPx:64,heightPx:64 };
const recipe = { path: "look", properties: { "stack-order": 0, fit: "cover", clip:"frame" } };
const ordinary = (source: Timeline) => ordinaryPerformance({ timeline:source,canvas,frame,window:window("use",0,180,source),
  fit:decodeMediaFit(recipe),sample:decodeMediaSampleSpec(recipe,"content","timed",undefined,true),spec:decodeMediaItemSpec(recipe,{id:"template",motion:{sustain:[]}}) });

test("Use overrides preserve original spans and an empty winner does not reveal earlier content", () => {
  let set = appendPerformanceUse({uses:[]},window("base",0,180),picture("base"));
  set = appendPerformanceUse(set,window("side",60,180),picture("side",60));
  set = appendPerformanceUse(set,window("move",60,90),picture("move",60,90));
  const empty = sealVisualTrack({id:"hidden",visualIr:"qflow.visual-ir@1",programSpaceId:timeline.id,presents:[]});
  set = appendPerformanceUse(set,window("hide",120,150),empty);
  const result = resolvePerformance(timeline,"presenter",set);
  assert.deepEqual(result.presents.map(p=>[p.span,p.visibility]),[
    [{startFrame:0,endFrameExclusive:180},[{startFrame:0,endFrameExclusive:60}]],
    [{startFrame:60,endFrameExclusive:90},[{startFrame:60,endFrameExclusive:90}]],
    [{startFrame:60,endFrameExclusive:180},[{startFrame:90,endFrameExclusive:120},{startFrame:150,endFrameExclusive:180}]],
  ]);
  const document = compileHyperframesDocument(sealComposition({id:"render",canvas:{width:64,height:64,clearColor:"#000000"},tracks:[result]}),timeline);
  assert.match(document.html,/data-qflow-visibility/);
  assert.match(document.html,/hf-seek/);
});

test("ordinary Performance supports no Takes, audio-only Takes, overlap and gaps without resampling origins", () => {
  assert.equal(ordinary(timeline).presents.length,0);
  const audio = timelineFixture(timeline,{segments:[{id:"a",frameCount:90},{id:"b",frameCount:90}]});
  assert.equal(ordinary(audio).presents.length,0);
  const source = { ...audio, items: audio.items.map((item,i)=>({...item,startFrame: i===0 ? 15:60,take:{...item.take,media:{...item.take.media,visual:{ artifact:{kind:"blob" as const,resource:`res_video${i}` as const,size:1,mediaType:"video/mp4"},width:64,height:64}}}})) };
  const result=ordinary(source);
  const videos=result.presents[0]!.elements.filter(e=>e.kind==="video");
  assert.equal(videos.length,2);
  assert.deepEqual(videos.map(v=>(v.kind === "video" ? v.sampling : undefined)?.segments[0]?.target),[{startFrame:15,endFrameExclusive:105},{startFrame:60,endFrameExclusive:150}]);
  assert.deepEqual(videos.map(v=>(v.kind === "video" ? v.sampling : undefined)?.segments[0]?.sourceFrame),[{numerator:0,denominator:1},{numerator:0,denominator:1}]);
  const excerpt=(id:string)=>({kind:"segment" as const,narrativeId:source.narrativeId,id,tokenStart:0,tokenEndExclusive:0});
  const mixed=crossfade(source,window("mix",60,105,source),excerpt("a"),excerpt("b"),frame);
  assert.equal(mixed.presents[0]!.elements.filter(e=>e.kind==="video").length,2);
  const move=movingFrame(source,window("move",30,120,source),frame,{...frame,xPx:32,widthPx:32});
  const doc=compileHyperframesDocument(sealComposition({id:"movement",canvas:{width:64,height:64,clearColor:"#000000"},tracks:[move]}),source);
  assert.match(doc.html,/source-0/);
  assert.match(doc.html,/viewport/);
  const single={...source,items:[source.items[0]!,{...source.items[1]!,take:audio.items[1]!.take}]};
  assert.equal(crossfade(single,window("mix",60,105,single),excerpt("a"),excerpt("b"),frame).presents[0]!.elements.filter(e=>e.kind==="video").length,1);
  assert.throws(()=>crossfade(source,window("mix",60,105,source),excerpt("missing"),excerpt("b"),frame),/Unknown/);
});

test("Style-bound inputs become explicit graph edges at each Use; a baseline needs no temporal selector", async () => {
  const reference=(id:string,type:SurfaceResolvedReference["type"]):SurfaceResolvedReference=>({path:id,type,ref:{kind:"record",id}});
  const bindings={frame:reference("frame",spatialTypes.frame),fit:reference("fit",spatialTypes.fit),sample:reference("sample",mediaTrackTypes.sampleLayerSpec),spec:reference("spec",mediaTrackTypes.itemSpec)};
  const style=performanceStyle(ordinaryPerformanceFragment,bindings);
  const refs = new Map<string, SurfaceResolvedReference>([
    ["timeline", reference("timeline",timelineTypes.track)],
    ["canvas", reference("canvas",spatialTypes.canvas)],
    ["style", { ...reference("style",performanceTypes.style), record: { id:"style", type:performanceTypes.style,
      value:{kind:"inline",value:canonicalize(style)} } }],
  ]);
  const range={source:"test.svml",start:0,end:1};
  const root:StructuredElement={kind:"element",name:"performance:Track",attributes:{id:"p",timeline:{kind:"reference",path:"timeline"},canvas:{kind:"reference",path:"canvas"}},range,children:[{kind:"element",name:"performance:Use",attributes:{style:{kind:"reference",path:"style"}},children:[],range}]};
  const result=await decodePerformanceTrackSurface({element:root,sourceName:"test.svml",resolveReference:path=>refs.get(path),resolveAsset:async()=>{throw new Error("unexpected");}});
  assert.equal(result.components.find(c=>c.id==="p.use.1.__style")?.inputs.frame?.kind,"record");
  assert.deepEqual(result.components.find(c=>c.id==="p.use.1.__style")?.inputs.frame,bindings.frame.ref);
  assert.deepEqual(result.components.at(-1)?.outputs,{visual:"p.visual",program:"p.program"});
});
