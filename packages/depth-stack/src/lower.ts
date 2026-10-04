import type { Timeline } from "@qflow/timeline";
import {
  assertVisualTrackIdentity,
  sealVisualTrack,
} from "@qflow/composition";
import type {
  VisualAnimation,
  VisualElement,
  VisualSourceTimeMap,
  VisualStyleDeclaration,
  VisualTrack,
} from "@qflow/composition";
import {
  lowerVisualClipElements,
  resolveMediaLayerPrograms,
  resolveVisualSourceTime,
} from "@qflow/visual-track";
import type {
  VisualClipProgram,
  MediaSampleLayer,
} from "@qflow/visual-track";
import type { SpatialFrame } from "@qflow/spatial";

import {
  assertDepthStackProgramIdentity,
  resolveDepthStackPose,
  resolveDepthStackState,
} from "./program.js";
import type {
  DepthStackCard,
  DepthStackPose,
  DepthStackProgram,
} from "./types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function px(value: number): string {
  return `${value}px`;
}

function poseStyle(value: DepthStackPose): VisualStyleDeclaration[] {
  return [
    {
      name: "filter",
      value: `brightness(${value.tone.brightness}) contrast(${value.tone.contrast}) saturate(${value.tone.saturation})`,
    },
    { name: "opacity", value: value.opacity },
    {
      name: "transform",
      value: `translate(${value.xPx}px,${value.yPx}px) rotate(${value.rotationDeg}deg) scale(${value.scale})`,
    },
  ];
}

function hiddenPose(program: DepthStackProgram, direction: "previous" | "next"): DepthStackPose {
  const depth = direction === "previous"
    ? -(program.spec.visibility.previous + 1)
    : program.spec.visibility.next + 1;
  return { ...resolveDepthStackPose(program.spec, depth), opacity: 0 };
}

function poseAnimation(input: {
  readonly program: DepthStackProgram;
  readonly stageDuration: number;
  readonly oldDepth?: number;
  readonly newDepth?: number;
}): VisualAnimation | undefined {
  if (input.newDepth === undefined && input.oldDepth === undefined) return undefined;
  if (input.program.spec.reflow.durationFrames === 0) return undefined;
  const oldPose = input.oldDepth === undefined
    ? hiddenPose(input.program, input.newDepth === 0 || input.newDepth! > 0 ? "next" : "previous")
    : resolveDepthStackPose(input.program.spec, input.oldDepth);
  const newPose = input.newDepth === undefined
    ? hiddenPose(input.program, input.oldDepth === 0 || input.oldDepth! < 0 ? "previous" : "next")
    : resolveDepthStackPose(input.program.spec, input.newDepth);
  const duration = input.program.spec.reflow.durationFrames;
  const keyframes = [
    { atFrame: 0, easing: input.program.spec.reflow.easing, style: poseStyle(oldPose) },
    { atFrame: duration, style: poseStyle(newPose) },
  ];
  if (duration < input.stageDuration) keyframes.push({ atFrame: input.stageDuration, style: poseStyle(newPose) });
  return { keyframes };
}

function rootBox(id: string, parent: string | undefined, order: number, style: VisualStyleDeclaration[], animation?: VisualAnimation): VisualElement {
  return {
    id,
    ...(parent === undefined ? {} : { parent }),
    order,
    kind: "box",
    style,
    ...(animation === undefined ? {} : { animation }),
  };
}

function rational(numerator: number, denominator = 1) {
  return { numerator, denominator };
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function sourceTiming(layer: MediaSampleLayer): {
  readonly frameRate: { readonly numerator: number; readonly denominator: number };
  readonly frameCount: number;
} | undefined {
  if (layer.source.kind === "timed") {
    return { frameRate: layer.source.frameRate, frameCount: layer.source.frameCount };
  }
  if (layer.source.kind === "surface" && layer.source.surface.timing.kind === "frames") {
    return {
      frameRate: layer.source.surface.timing.frameRate,
      frameCount: layer.source.surface.timing.frameCount,
    };
  }
  return undefined;
}

function heldSourceTime(
  timing: NonNullable<ReturnType<typeof sourceTiming>>,
  targetFrames: number,
  sourceFrame: number,
): VisualSourceTimeMap {
  return {
    sourceFrameRate: { ...timing.frameRate },
    sourceFrameCount: timing.frameCount,
    pieces: [{
      target: { startFrame: 0, endFrameExclusive: targetFrames },
      sourceAtStart: rational(sourceFrame),
      rate: rational(0),
    }],
  };
}

function continuedSourceTime(input: {
  readonly timing: NonNullable<ReturnType<typeof sourceTiming>>;
  readonly targetFrames: number;
  readonly absoluteStart: number;
  readonly activationFrame: number;
}): VisualSourceTimeMap {
  const length = input.timing.frameCount;
  const phase = modulo(input.absoluteStart - input.activationFrame, length);
  return {
    sourceFrameRate: { ...input.timing.frameRate },
    sourceFrameCount: input.timing.frameCount,
    pieces: [{
      target: { startFrame: 0, endFrameExclusive: input.targetFrames },
      sourceAtStart: rational(phase),
      rate: rational(1),
      wrap: { startFrame: 0, endFrameExclusive: input.timing.frameCount },
    }],
  };
}

function sourceTimeFor(input: {
  readonly program: DepthStackProgram;
  readonly card: DepthStackCard;
  readonly layer: MediaSampleLayer;
  readonly relation: number;
  readonly stageStart: number;
  readonly stageDuration: number;
  readonly timeline: Timeline;
}): VisualSourceTimeMap | undefined {
  const timing = sourceTiming(input.layer);
  if (timing === undefined) return undefined;
  assert(timing.frameRate.numerator === input.timeline.frameRate.numerator
    && timing.frameRate.denominator === input.timeline.frameRate.denominator,
  `DepthStack Card ${input.card.id} timed material must be normalized to Timeline.`);
  if (input.relation === 0) {
    if (input.layer.sourceTime?.kind === "map") return input.layer.sourceTime.value;
    return resolveVisualSourceTime({
      timeline: input.timeline,
      sourceFrameRate: timing.frameRate,
      sourceFrameCount: timing.frameCount,
      targetFrameCount: input.stageDuration,
      ...(input.layer.sourceTime?.kind !== "spec" ? {} : { spec: input.layer.sourceTime.value }),
    });
  }
  const mode = input.relation > 0 ? input.card.playback.future : input.card.playback.past;
  if (mode === "continue") {
    return continuedSourceTime({
      timing,
      targetFrames: input.stageDuration,
      absoluteStart: input.stageStart,
      activationFrame: input.card.activationFrame,
    });
  }
  return heldSourceTime(
    timing,
    input.stageDuration,
    mode === "hold-tail" ? timing.frameCount - 1 : 0,
  );
}

function groupElements(input: {
  readonly program: DepthStackProgram;
  readonly stageStart: number;
  readonly stageEnd: number;
  readonly pose: DepthStackPose;
  readonly poseAnimation?: VisualAnimation;
}): { readonly elements: VisualElement[]; readonly poseParent: string } {
  const frame = input.program.frame;
  let order = 0;
  const elements: VisualElement[] = [rootBox("deck-placement", undefined, order++, [
    { name: "height", value: px(frame.heightPx) },
    { name: "left", value: px(frame.xPx) },
    { name: "position", value: "absolute" },
    { name: "top", value: px(frame.yPx) },
    { name: "width", value: px(frame.widthPx) },
  ])];
  elements.push(rootBox("deck-pose", "deck-placement", order++, [
    { name: "height", value: "100%" },
    { name: "position", value: "absolute" },
    { name: "transform-origin", value: "center center" },
    { name: "width", value: "100%" },
    ...poseStyle(input.pose),
  ], input.poseAnimation));
  return { elements, poseParent: "deck-pose" };
}

function localFrame(frame: SpatialFrame): SpatialFrame {
  return {
    xPx: 0,
    yPx: 0,
    widthPx: frame.widthPx,
    heightPx: frame.heightPx,
  };
}

function labelElement(card: DepthStackCard, parent: string, order: number): VisualElement | undefined {
  if (card.label.kind === "none") return undefined;
  return {
    id: "deck-label",
    parent,
    order,
    kind: "text-flow",
    style: [{ name: "position", value: "absolute" }, { name: "inset", value: 0 }],
    document: structuredClone(card.label.document),
    typography: structuredClone(card.label.typography),
    paints: structuredClone(card.label.paints),
    flow: structuredClone(card.label.flow),
    sequences: [],
  };
}

export function renderDepthStack(
  timeline: Timeline,
  program: DepthStackProgram,
): VisualTrack {
  assertDepthStackProgramIdentity(program, timeline);
  const presents: VisualTrack["presents"][number][] = [];
  for (let stageIndex = 0; stageIndex < program.cards.length; stageIndex += 1) {
    const stageStart = program.cards[stageIndex]!.activationFrame;
    const stageEnd = program.cards[stageIndex + 1]?.activationFrame ?? program.terminalFrame;
    const stageDuration = stageEnd - stageStart;
    const oldState = stageIndex === 0 ? new Map<number, number>() : resolveDepthStackState(program, stageIndex - 1);
    const newState = resolveDepthStackState(program, stageIndex);
    const cardIndices = stageIndex === 0 || program.spec.reflow.durationFrames === 0
      ? [...newState.keys()]
      : [...new Set([...oldState.keys(), ...newState.keys()])];
    for (const cardIndex of cardIndices) {
      const card = program.cards[cardIndex]!;
      const oldDepth = oldState.get(cardIndex);
      const newDepth = newState.get(cardIndex);
      const staticPose = newDepth === undefined
        ? hiddenPose(program, oldDepth === 0 || (oldDepth ?? -1) < 0 ? "previous" : "next")
        : resolveDepthStackPose(program.spec, newDepth);
      const animation = stageIndex === 0 ? undefined : poseAnimation({
        program,
        stageDuration,
        ...(oldDepth === undefined ? {} : { oldDepth }),
        ...(newDepth === undefined ? {} : { newDepth }),
      });
      const group = groupElements({
        program,
        stageStart,
        stageEnd,
        pose: staticPose,
        ...(animation === undefined ? {} : { poseAnimation: animation }),
      });
      const relation = newDepth ?? (oldDepth === 0 ? -1 : oldDepth ?? 1);
      const sourceTimeOverrides: Record<string, VisualSourceTimeMap> = {};
      const samplingAnimationOverrides: Record<string, VisualAnimation | null> = {};
      for (const layer of card.material.layers) {
        if (layer.kind !== "sample") continue;
        const sourceTime = sourceTimeFor({ program, card, layer, relation, stageStart, stageDuration, timeline });
        if (sourceTime !== undefined) sourceTimeOverrides[layer.id] = sourceTime;
        if (relation !== 0 && layer.samplingMotion !== undefined) samplingAnimationOverrides[layer.id] = null;
      }
      const mediaItem: VisualClipProgram = {
        id: "deck-material",
        subjectId: card.id,
        span: { startFrame: stageStart, endFrameExclusive: stageEnd },
        frame: localFrame(program.frame),
        treatment: structuredClone(program.spec.treatment),
        layers: resolveMediaLayerPrograms(card.material, localFrame(program.frame), program.spec.treatment),
        order: 0,
        z: 0,
      };
      const material = [...lowerVisualClipElements(mediaItem, timeline, {
        placementParent: group.poseParent,
        poseAnimationOverride: null,
        sourceTimeOverrides,
        samplingAnimationOverrides,
      })].map((element) => ({ ...element, order: element.order + group.elements.length }));
      const frameId = `${mediaItem.id}:frame`;
      const label = labelElement(card, frameId, material.reduce((maximum, element) => Math.max(maximum, element.order), 0) + 1);
      presents.push({
        id: `${card.id}:stage:${stageIndex + 1}`,
        order: presents.length,
        z: program.spec.stackingOrder + (newDepth === undefined
          ? resolveDepthStackPose(program.spec, oldDepth ?? 0).stacking
          : resolveDepthStackPose(program.spec, newDepth).stacking),
        subjectId: card.id,
        span: { startFrame: stageStart, endFrameExclusive: stageEnd },
        elements: [...group.elements, ...material, ...(label === undefined ? [] : [label])],
      });
    }
  }
  const track = sealVisualTrack({
    timelineId: timeline.id,
    visualIr: "qflow.visual-ir@1",
    id: program.id,
    presents,
  });
  assertVisualTrackIdentity(track, timeline);
  return track;
}
