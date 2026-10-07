import assert from "node:assert/strict";
import test from "node:test";

import { mediaLocalTemporalDomain } from "@qflow/media";
import type { Narrative } from "@qflow/narrative";
import { captionUnitsForNarrativeSelection, projectNarrativeCaptionTiming } from "@qflow/narrative-caption";
import { captionDocument, narrativeCaptionBinding, narrativeValue, parseScript } from "@qflow/script";
import { createNarrativeProjection, projectNarrativeAlignment, selectionFrameSpan } from "@qflow/narrative-temporal";
import { alignNarrative } from "@qflow/narrative-speech-alignment";
import type { Timeline } from "@qflow/timeline";
import { interpretWhisperXTranscript } from "@qflow/whisperx";

import { fixtureResource } from "./fixture-resource.js";

test("Caption uses complete Narrative selections and authored cue breaks", () => {
  const parsed = parseScript("caption.svml", "<line>one @{focus} two three @{/focus} || four</line>");
  const narrative = narrativeValue(parsed, "story") as unknown as Narrative;
  const document = captionDocument(parsed, "story.caption", "story");
  const binding = narrativeCaptionBinding(parsed, "story.caption", "story");
  const selection = narrative.selections[0]!;
  const subset = captionUnitsForNarrativeSelection(document, binding, narrative, selection);
  assert.equal(subset.unitIds.length, 2);
  assert.equal(document.cueBreaks.length, 1);
});

test("Caption selects complete Segments and the program through structural anchors", () => {
  const parsed = parseScript("caption-ranges.svml", `@{~whole}
@{opening} <intro><HOST>One idea.</intro> @{/opening}
<answer><GUEST>Another view.</answer>
@{/whole~}`);
  const narrative = narrativeValue(parsed, "story") as unknown as Narrative;
  const document = captionDocument(parsed, "story.caption", "story");
  const binding = narrativeCaptionBinding(parsed, "story.caption", "story");
  const whole = narrative.selections.find((selection) => selection.id === "whole")!;
  const opening = narrative.selections.find((selection) => selection.id === "opening")!;
  assert.deepEqual(captionUnitsForNarrativeSelection(document, binding, narrative, whole).unitIds,
    document.units.map((unit) => unit.id));
  assert.deepEqual(captionUnitsForNarrativeSelection(document, binding, narrative, opening).unitIds,
    document.units.filter((unit) => unit.groupId?.startsWith("intro:")).map((unit) => unit.id));
});

for (const grouped of [false, true]) test(`Chinese Script projects Caption timing through explicit alignments and domain Windows (shared groups: ${grouped})`, () => {
  const parsed = parseScript("mixed-zh.svml", `<opening><HOST>用@{brand} ElevenLabs @{/brand}做${grouped ? '<视频|>' : '视频'}，|| 真方便。</opening>
<answer><GUEST>今年<2026|二零二六>年，這個很好。</answer>`);
  const narrative = narrativeValue(parsed, "story") as unknown as Narrative;
  const document = captionDocument(parsed, "story.caption", "story");
  const binding = narrativeCaptionBinding(parsed, "story.caption", "story");
  const phrases = ["用ElevenLabs做视频真方便", "今年二零二六年这个很好"];
  const durations = [4000, 3000];
  const timeline: Timeline = { id: "speech", frameRate: { numerator: 1000, denominator: 1 }, frameCount: 7000 };
  const evidenceWindows: Array<Array<[number, number]>> = [];
  const entries = [] as Parameters<typeof createNarrativeProjection>[3][number][];
  let targetStartFrame = 0;

  for (const [index, segment] of narrative.segments.entries()) {
    let cursor = 100;
    const words = [...phrases[index]!].map((word, characterIndex) => {
      const start = cursor;
      cursor += characterIndex % 3 === 0 ? 190 : 90;
      const end = cursor;
      cursor += characterIndex % 4 === 0 ? 80 : 20;
      return { word, start: start / 1000, end: end / 1000 };
    });
    evidenceWindows.push(words.map((word) => [Math.round(word.start * 1000), Math.round(word.end * 1000)]));
    const frameCount = durations[index]!;
    const sampleFrames = frameCount * 16;
    const media = {
      frameDomain: { frameRate: timeline.frameRate, frameCount },
      audio: { artifact: { kind: "blob" as const, resource: fixtureResource(`zh:${index}`), size: 1, mediaType: "audio/wav" } },
    };
    const domain = mediaLocalTemporalDomain(`zh:${index}:domain`, media);
    const excerpt = { narrativeId: narrative.id, kind: "segment" as const, id: segment.id,
      tokenStart: segment.tokenStart, tokenEndExclusive: segment.tokenEndExclusive };
    const alignment = alignNarrative(narrative, excerpt, domain, {
      domainId: domain.id,
      sampleFrames,
      passages: interpretWhisperXTranscript({ language: "zh", segments: [{ start: 0, end: frameCount / 1000, words }] }, sampleFrames),
    });
    const endFrameExclusive = targetStartFrame + frameCount;
    const window = {
      id: `zh:${index}:window`, subjectId: segment.id,
      start: { id: `zh:${index}:start`, subjectId: segment.id, timelineId: timeline.id, frame: targetStartFrame },
      end: { id: `zh:${index}:end`, subjectId: segment.id, timelineId: timeline.id, frame: endFrameExclusive },
      span: { startFrame: targetStartFrame, endFrameExclusive },
    };
    entries.push(projectNarrativeAlignment(alignment, domain, window, timeline));
    targetStartFrame += frameCount;
  }

  const narrativeProjection = createNarrativeProjection("speech-semantic", narrative.id, timeline, entries);
  const timing = projectNarrativeCaptionTiming(document, binding, narrativeProjection);
  const wordText = new Map(document.words.map((word) => [word.id, word.text]));
  const unitText = new Map(document.units.map((unit) => [unit.id, unit.wordIds.map((id) => wordText.get(id)!).join("")]));
  assert.deepEqual(timing.cues.map((cue) => cue.units.map((unit) => unitText.get(unit.unitId)).join("")),
    ["用ElevenLabs做视频，", "真方便。", "今年2026年，這個很好。"]);
  const units = timing.cues.flatMap((cue) => cue.units);
  const windowsFor = (text: string) => units.filter((unit) => unitText.get(unit.unitId) === text)
    .map((unit) => [unit.startFrame, unit.endFrameExclusive]);
  const first = evidenceWindows[0]!;
  assert.deepEqual(windowsFor("用"), [first[0]]);
  assert.deepEqual(windowsFor("ElevenLabs"), [[first[1]![0], first[10]![1]]]);
  assert.deepEqual(windowsFor("做"), [first[11]]);
  if (grouped) assert.deepEqual(windowsFor("视频，"), [[first[12]![0], first[13]![1]]]);
  const alignedFirst = entries[0]!;
  const framesByBoundary = new Map(alignedFirst.boundaries.map((boundary) => [boundary.id, boundary.frame]));
  assert.deepEqual(alignedFirst.tokens.filter((token) => ["做", "视", "频"].includes(token.text))
    .map((token) => [framesByBoundary.get(token.startBoundaryId), framesByBoundary.get(token.endBoundaryId)]), first.slice(11, 14));
  assert.deepEqual(selectionFrameSpan(narrativeProjection, { ...narrative.selections[0]!, narrativeId: narrative.id }),
    { startFrame: first[1]![0], endFrameExclusive: first[10]![1] });
  const second = evidenceWindows[1]!;
  assert.deepEqual(windowsFor("2026"), [[4000 + second[2]![0], 4000 + second[5]![1]]]);
  assert.deepEqual(windowsFor("這"), [[4000 + second[7]![0], 4000 + second[7]![1]]]);
  assert.deepEqual(windowsFor("個"), [[4000 + second[8]![0], 4000 + second[8]![1]]]);
  assert.equal(document.units[0]!.role, "HOST");
});
