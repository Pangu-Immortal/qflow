import assert from "node:assert/strict";
import test from "node:test";

import type { FineCaptionSchedule } from "@qflow/caption-fine";
import { captionTypes } from "@qflow/caption";
import type { CaptionDocument } from "@qflow/caption";
import { compositionTypes } from "@qflow/composition";
import type { StudioTrackCompanionContext, StudioEntityDraft } from "@qflow/studio-adapter";

import { captionFineInspectorFields, projectCaptionContents } from "../src/index.js";

test("Caption Companion owns Inspector grouping", () => {
  const declared = (name: string) => captionFineInspectorFields.find((field) => field.binding === `style.${name}`);
  assert.equal(declared("x")?.domain, "where");
  assert.equal(declared("x")?.section.id, "region");
  assert.equal(declared("cue-shadow-blur")?.domain, "how");
  assert.equal(declared("active-box-enter")?.domain, "when");
  assert.equal(declared("lead-frames")?.section.id, "envelope");
});

test("Caption Companion projects Cue text and Style from public domain values", () => {
  const schedule: FineCaptionSchedule = {
    timelineId: "speech",
    documentId: "story.caption",
    cues: [{
      id: "cue-1", cueId: "cue-1", visibility: [{startFrame:8,endFrameExclusive:24}],
      styleId: "caption-alt",
      timedStartFrame: 10,
      timedEndFrameExclusive: 20,
      visibleStartFrame: 8,
      visibleEndFrameExclusive: 24,
      units: [{ unitId: "unit-1", startFrame: 10, endFrameExclusive: 20 }],
    }],
  };
  const document: CaptionDocument = {
    id: "story.caption",
    units: [{ id: "unit-1", groupId: "segment-1:turn-1", wordIds: ["word-1", "word-2"] }],
    words: [
      { id: "word-1", unitId: "unit-1", text: "真实", separatorBefore: "", attributes: [] },
      { id: "word-2", unitId: "unit-1", text: "字幕", separatorBefore: "", attributes: [] },
    ],
    cueBreaks: [],
  };
  const base: StudioEntityDraft = {
    id: "captions.track:cue-1", authoredId: "captions", display: { title: "cue-1", layers: [] },
    startFrame: 8, endFrameExclusive: 24, stackOrder: 70, presentId: "cue-1",
    elementRange: { start: 0, end: 80 },
  };
  const context = {
    track: {
      name: "captions.track", type: "VisualTrack", typeRef: compositionTypes.visualTrack, outputRef: "captions.track",
      candidateOrigin: "source", role: "track",
      trace: {
        surface: "caption", module: { name: "@qflow/caption-fine", version: "1" }, authoredId: "captions",
        outputPorts: [{ name: "schedule", ref: "captions.schedule", type: "FineCaptionSchedule" }, { name: "timing", ref: "captions.timing", type: "CaptionTiming" }],
        references: [{
          input: "document", name: "story.caption", ref: "story.caption", type: "CaptionDocument",
          typeRef: captionTypes.document,
        }, {
          input: "timing", name: "story-captions", ref: "captions.timing", type: "CaptionTiming",
          typeRef: captionTypes.timing,
        }],
      },
      value: { visualIr: "qflow.visual-ir@1", id: "captions", presents: [] },
    },
    spans: [{ id: "cue-1", startFrame: 8, endFrameExclusive: 24, stackOrder: 70 }],
    values: new Map<string, unknown>([["captions.schedule", schedule], ["captions.timing", {timelineId:"speech",documentId:document.id, cues:[{id:"cue-1",startFrame:10,endFrameExclusive:20,units:schedule.cues[0]!.units}]}], ["story.caption", document]]),
    temporalBindings: [],
    semantic: { timelineId: "speech", narrativeId: "story", presentation: { family: "speech", tone: "teal", icon: "timeline", lane: { heightPx: 45 } }, anchors: [], segments: [], tokens: [], selections: [], moments: [], provenance: { output: "speech", outputRef: "speech", origin: "source", status: "resolved", errors: [] } },
    generic: () => [base],
  } satisfies StudioTrackCompanionContext;
  const [cue] = projectCaptionContents(context);
  assert.deepEqual(cue?.display, {
    title: "#1",
    layers: [{ kind: "text", role: "content", text: "真实字幕" }],
  });
  for (const [texts, separators, expected] of [
    [["3", "D"], ["", ""], "3D"],
    [["3", "개월"], ["", ""], "3개월"],
    [["是的", "就是这样"], ["", " "], "是的 就是这样"],
    [["hello", "world"], [" ", " "], "hello world"],
  ] as const) {
    const variant = { ...document, words: document.words.map((word, index) => ({ ...word,
      text: texts[index]!, separatorBefore: separators[index]!,
    })) };
    const values = new Map(context.values);
    values.set("story.caption", variant);
    assert.equal(projectCaptionContents({ ...context, values })[0]!.display.layers[0]!.kind, "text");
    assert.deepEqual(projectCaptionContents({ ...context, values })[0]!.display.layers,
      [{ kind: "text", role: "content", text: expected }]);
  }
  assert.equal(cue?.presentation?.chrome, "standard");
  assert.equal(cue?.parameterReferences, undefined);
  assert.deepEqual([cue?.startFrame, cue?.endFrameExclusive], [10, 20]);
});

test("Caption Uses keep authored windows and child ownership even with no rendered content", async () => {
  const { projectCaption } = await import("../src/index.js");
  const { temporalTypes } = await import("@qflow/temporal");
  const { timelineFixture } = await import("../../../test/timeline-fixture.js");
  const { projectProgramWindow } = await import("../../../test/temporal-fixture.js");
  const timeline = timelineFixture({id:"film",frameCount: 180, frameRate: { numerator: 30, denominator: 1 }}, {segments:[{id:"a",frameCount:90},{id:"b",frameCount:90}]});
  const uses = ["base", "hidden"].map(id=>({styleId:id,window:projectProgramWindow({itemId:id,semantic:timeline,projection:{start:{ref:"timeline.start"},end:{ref:"timeline.end"}}})}));
  const context = {
    track:{outputRef:"captions.track",trace:{references:[{input:"document",typeRef:captionTypes.document,ref:"document"},{input:"timing",typeRef:captionTypes.timing,ref:"timing"}],outputPorts:[{name:"schedule",ref:"schedule"},{name:"program",ref:"program"}]}},
    placement:{children:uses.map((use,i)=>({range:{start:i*10,end:i*10+8},referenceAttributes:{style:use.styleId},values:[{type:temporalTypes.windowSpec,value:{id:use.window.subjectId}}]}))},
    values:new Map<string,unknown>([["document",{id:"document",units:[],words:[]}],["timing",{timelineId:"film",documentId:"document",cues:[]}],["schedule",{cues:[]}],["program",{uses}]]),
    spans:[],temporalBindings:[],
  } as unknown as StudioTrackCompanionContext;
  const entities=projectCaption(context);
  assert.deepEqual(entities.map(item=>[item.display.title,item.startFrame,item.endFrameExclusive,item.elementRange]),[
    ["base",0,180,{start:0,end:8}],["hidden",0,180,{start:10,end:18}],
  ]);
  assert.ok(entities.every(item=>item.band==="uses" && item.presentation?.chrome==="standard"));
});
