import { timelineTypes } from "@qflow/qflow/timeline";

import { blobTypes } from "@qflow/qflow/blob";
import { compositionTypes } from "@qflow/qflow/composition";
import { sealGraphFragment } from "@qflow/qflow/author";
import type { FragmentOperation, GraphFragment } from "@qflow/qflow/author";
import { mediaTypes } from "@qflow/qflow/media";
import { visualTrackProducers, visualTrackTypes } from "@qflow/visual-track";
import { spatialTypes } from "@qflow/qflow/spatial";
import { temporalTypes } from "@qflow/qflow/temporal";

import { depthStackProducers, depthStackTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

export type DepthStackFragmentCard = {
  readonly suffix: string;
  readonly sourceKind: "still" | "timed" | "surface";
  readonly sourceName: string;
  readonly extentName?: string;
  readonly fitName: string;
  readonly sampleSpecName: string;
  readonly framePaintSpecName?: string;
  readonly labelName: string;
  readonly cardSpecName: string;
  readonly activationName: string;
};

function sourceInput(card: DepthStackFragmentCard): GraphFragment["inputs"][number] {
  const type = card.sourceKind === "still"
    ? blobTypes.blob
    : card.sourceKind === "timed" ? mediaTypes.synchronized : mediaTypes.compositableSurface;
  return { name: card.sourceName, type };
}

export function createDepthStackFragment(
  cards: readonly DepthStackFragmentCard[],
  terminalName: string,
) {
  if (cards.length === 0) throw new Error("DepthStack Fragment requires Cards.");
  const inputs: Array<GraphFragment["inputs"][number]> = [
    { name: "frame", type: spatialTypes.frame },
    { name: "header", type: depthStackTypes.header },
    { name: "timeline", type: timelineTypes.timeline },
    { name: "spec", type: depthStackTypes.spec },
  ];
  const operations: FragmentOperation[] = [
    {
      id: "cards",
      producer: depthStackProducers.createCards,
      inputs: {},
      result: { kind: "output", name: "set" },
    },
  ];
  let cardSet = operation("cards");
  for (const card of cards) {
    inputs.push(sourceInput(card));
    if (card.extentName !== undefined) inputs.push({ name: card.extentName, type: spatialTypes.extent });
    inputs.push(
      { name: card.fitName, type: spatialTypes.fit },
      { name: card.sampleSpecName, type: visualTrackTypes.sampleLayerSpec },
      { name: card.labelName, type: depthStackTypes.cardLabel },
      { name: card.cardSpecName, type: depthStackTypes.cardSpec },
      { name: card.activationName, type: temporalTypes.instant },
    );
    if (card.framePaintSpecName !== undefined) {
      inputs.push({ name: card.framePaintSpecName, type: visualTrackTypes.paintLayerSpec });
    }
    const layersId = `layers-${card.suffix}`;
    operations.push({
      id: layersId,
      producer: visualTrackProducers.createLayers,
      inputs: {},
      result: { kind: "output", name: "layers" },
    });
    let layers = operation(layersId);
    if (card.framePaintSpecName !== undefined) {
      const paintId = `paint-${card.suffix}`;
      operations.push({
        id: paintId,
        producer: visualTrackProducers.appendPaintLayer,
        inputs: { layers, spec: input(card.framePaintSpecName) },
        result: { kind: "output", name: "layers" },
      });
      layers = operation(paintId);
    }
    const sampleId = `sample-${card.suffix}`;
    const producer = card.sourceKind === "still"
      ? visualTrackProducers.appendStillLayer
      : card.sourceKind === "timed" ? visualTrackProducers.appendTimedLayer : visualTrackProducers.appendSurfaceLayer;
    operations.push({
      id: sampleId,
      producer,
      inputs: {
        layers,
        source: input(card.sourceName),
        ...(card.extentName === undefined ? {} : { extent: input(card.extentName) }),
        fit: input(card.fitName),
        spec: input(card.sampleSpecName),
      },
      result: { kind: "output", name: "layers" },
    });
    const appendId = `append-${card.suffix}`;
    operations.push({
      id: appendId,
      producer: depthStackProducers.appendCard,
      inputs: {
        set: cardSet,
        timeline: input("timeline"),
        material: operation(sampleId),
        label: input(card.labelName),
        spec: input(card.cardSpecName),
        activation: input(card.activationName),
      },
      result: { kind: "output", name: "set" },
    });
    cardSet = operation(appendId);
  }
  inputs.push({ name: terminalName, type: temporalTypes.instant });
  operations.push({
    id: "program",
    producer: depthStackProducers.finalize,
    inputs: {
      set: cardSet,
      header: input("header"),
      frame: input("frame"),
      spec: input("spec"),
      timeline: input("timeline"),
      terminal: input(terminalName),
    },
    result: { kind: "output", name: "program" },
  });
  operations.push({
    id: "track",
    producer: depthStackProducers.render,
    inputs: { timeline: input("timeline"), program: operation("program") },
    result: { kind: "output", name: "track" },
  });
  return sealGraphFragment({
    inputs,
    operations,
    exports: [
      { name: "program", type: depthStackTypes.program, root: operation("program") },
      { name: "visual", type: compositionTypes.visualTrack, root: operation("track") },
    ],
  });
}
