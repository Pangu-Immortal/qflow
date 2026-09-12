import { projectTimelineAudio, projectTimelineMedia } from "@qflow/timeline";
import assert from "node:assert/strict";
import test from "node:test";
import { fixtureResource } from "../../../test/fixture-resource.js";

import type { SynchronizedMedia } from "@qflow/media";
import type { SemanticTake } from "@qflow/speech";
import {
  appendTimelineAuthorTake,
  assembleTimelineAuthor,
  createTimelineAuthorSet,
  sealTimelineAuthorHeader,
} from "@qflow/timeline-author";

function semantic(id: string, visual: boolean): SemanticTake {
  const media: SynchronizedMedia = {
    timeline: { frameRate: { numerator: 30, denominator: 1 }, frameCount: 30 },
    ...(visual ? { visual: {
      artifact: { kind: "blob", resource: fixtureResource(`${id}:video`), size: 1, mediaType: "video/mp4" },
      width: 720,
      height: 1280,
    } } : {}),
    audio: { artifact: { kind: "blob", resource: fixtureResource(`${id}:audio`), size: 1, mediaType: "audio/wav" } },
  };
  return {
    narrativeId: "test-narrative",
    media,
    segment: {
      segmentId: id,
      startAnchorId: `segment:${id}:start`,
      endAnchorId: `segment:${id}:end`,
      startFrame: 0,
      endFrameExclusive: 30,
    },
    tokens: [],
    anchors: [
      { identity: `segment:${id}:start`, frame: 0 },
      { identity: `segment:${id}:end`, frame: 30 },
    ],
  };
}

test("semantic assembly retains audio and material timing without requiring placement", () => {
  const track = assembleTimelineAuthor(sealTimelineAuthorHeader({ id: "speech" }),
    appendTimelineAuthorTake(appendTimelineAuthorTake(createTimelineAuthorSet(), semantic("voiceover", false)), semantic("answer", true)), { frameRate: { numerator: 30, denominator: 1 } });
  assert.deepEqual(track.items.map(item => item.take.segment.segmentId), ["voiceover", "answer"]);
  const audio = projectTimelineAudio(track);
  assert.deepEqual(audio.clips.map(clip => clip.target), [
    { startSample: 0, endSampleExclusive: 48000 }, { startSample: 48000, endSampleExclusive: 96000 },
  ]);
  const selected = projectTimelineMedia(track, { startFrame: 20, endFrameExclusive: 45 });
  assert.deepEqual(selected.map(({ span, source }) => ({ span, source })), [
    { span: { startFrame: 20, endFrameExclusive: 30 }, source: { startFrame: 20, endFrameExclusive: 30 } },
    { span: { startFrame: 30, endFrameExclusive: 45 }, source: { startFrame: 0, endFrameExclusive: 15 } },
  ]);
  assert.equal(selected[0]!.media.visual, undefined);
  assert.equal(selected[1]!.media.visual?.artifact.resource, fixtureResource("answer:video"));
});

const clock = { frameRate: { numerator: 30, denominator: 1 } };
function placed(end: string | undefined, at: readonly string[], lengths: readonly number[]) {
  let set = createTimelineAuthorSet();
  for (const [i, length] of lengths.entries()) {
    const take = semantic(`take-${i}`, true);
    set = appendTimelineAuthorTake(set, { ...take,
      media: { ...take.media, timeline: { ...take.media.timeline, frameCount: length } },
      segment: { ...take.segment, endFrameExclusive: length },
      anchors: [take.anchors[0]!, { ...take.anchors[1]!, frame: length }],
    });
  }
  return assembleTimelineAuthor({ id: "program", at, ...(end === undefined ? {} : { end }) }, set, clock);
}

test("one Timeline supports leading, interior and trailing gaps without source material", () => {
  const timeline = placed("30s", ["2s", "22s"], [180, 180]);
  assert.equal(timeline.durationSec, 30);
  assert.deepEqual(timeline.items.map(item => item.startFrame), [60, 660]);
  for (const [startFrame, endFrameExclusive] of [[0, 60], [240, 660], [840, 900]]) {
    assert.deepEqual(projectTimelineMedia(timeline, { startFrame: startFrame!, endFrameExclusive: endFrameExclusive! }), []);
  }
  assert.deepEqual(projectTimelineAudio(timeline).clips.map(clip => clip.target), [
    { startSample: 96000, endSampleExclusive: 384000 },
    { startSample: 1056000, endSampleExclusive: 1344000 },
  ]);
});

test("overlap retains both sources; content end is the latest end rather than declaration order", () => {
  const timeline = placed("content.end+2s", ["2s", "previous.end-12f", "3s"], [180, 60, 30]);
  assert.deepEqual(timeline.items.map(item => item.startFrame), [60, 228, 90]);
  assert.equal(timeline.durationSec, 348 / 30);
  const samples = projectTimelineMedia(timeline, { startFrame: 228, endFrameExclusive: 240 });
  assert.deepEqual(samples.map(sample => sample.source), [
    { startFrame: 168, endFrameExclusive: 180 }, { startFrame: 0, endFrameExclusive: 12 },
  ]);
  assert.equal(projectTimelineAudio(timeline).clips.length, 3);
});

test("a zero-Take Timeline supplies its Clock and extent without a Narrative or audio", () => {
  const timeline = assembleTimelineAuthor({ id: "animation", end: "30s" }, createTimelineAuthorSet(), clock);
  assert.equal(timeline.narrativeId, undefined);
  assert.equal(timeline.durationSec, 30);
  assert.deepEqual(timeline.items, []);
  assert.deepEqual(projectTimelineMedia(timeline), []);
  assert.deepEqual(projectTimelineAudio(timeline).clips, []);
  assert.throws(() => assembleTimelineAuthor({ id: "animation" }, createTimelineAuthorSet(), clock), /positive end/);
});

test("placement rejects missing predecessors, negative starts, fractional frames and clipped content", () => {
  assert.throws(() => placed(undefined, ["previous.end"], [30]), /no preceding/);
  assert.throws(() => placed(undefined, ["0f", "previous.end-2s"], [30, 30]), /non-negative/);
  assert.throws(() => placed(undefined, ["0.01s"], [30]), /exact frame/);
  assert.throws(() => placed("1s", ["2s"], [30]), /precedes placed content/);
});

test("word and Selection locations translate with the Take without reordering authored endpoints", async () => {
  const { semanticAnchorFrames, selectionFrameSpan, momentFrame, tokenFrameSpan } = await import("@qflow/timeline");
  const base = semantic("opening", true);
  const take = { ...base, tokens: [{ tokenId: "word", segmentId: "opening", text: "Hello",
    startAnchorId: "word:start", endAnchorId: "word:end", startFrame: 5, endFrameExclusive: 20 }],
    anchors: [...base.anchors, { identity: "word:start", frame: 5 }, { identity: "word:end", frame: 20 }] };
  const timeline = assembleTimelineAuthor({ id: "program", at: ["2s"], end: "5s" },
    appendTimelineAuthorTake(createTimelineAuthorSet(), take), clock);
  assert.deepEqual(tokenFrameSpan(timeline, ["word"]), { startFrame: 65, endFrameExclusive: 80 });
  assert.equal(momentFrame(timeline, { narrativeId: take.narrativeId, id: "cue", anchorId: "word:start" }), 65);
  assert.deepEqual(selectionFrameSpan(timeline, { narrativeId: take.narrativeId, id: "selection",
    startAnchorId: "word:end", endAnchorId: "word:start" }), { startFrame: 80, endFrameExclusive: 65 });
  const anchors = semanticAnchorFrames(timeline);
  assert.equal(anchors.get("program:start"), 0);
  assert.equal(anchors.get("program:end"), 150);
  assert.equal(anchors.get(base.segment.startAnchorId), 60);
  assert.deepEqual(take.tokens[0], timeline.items[0]!.take.tokens[0]);
});
