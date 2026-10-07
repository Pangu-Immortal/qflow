import { assertSpatialFrame, assertSpatialPath } from "@qflow/qflow/spatial";
import type { SpatialFrame } from "@qflow/qflow/spatial";

import type { VisualFrameTreatment } from "./types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function finite(value: number, label: string): void {
  assert(Number.isFinite(value), `${label} must be finite.`);
}

export function assertVisualFrameTreatment(value: VisualFrameTreatment, label: string): void {
  assert(["none", "frame", "rounded", "path"].includes(value.clip.kind), `${label}.clip is invalid.`);
  if (value.clip.kind === "rounded") {
    finite(value.clip.radiusPx, `${label}.clip.radiusPx`);
    assert(value.clip.radiusPx >= 0, `${label}.clip.radiusPx is invalid.`);
  }
  if (value.clip.kind === "path") assertSpatialPath(value.clip.path);
  for (const [name, padding] of Object.entries(value.padding)) {
    finite(padding, `${label}.padding.${name}`);
    assert(padding >= 0, `${label}.padding.${name} is invalid.`);
  }
  if (value.border !== undefined) {
    finite(value.border.widthPx, `${label}.border.widthPx`);
    assert(value.border.widthPx >= 0 && ["solid", "dashed", "dotted"].includes(value.border.style)
      && value.border.color.length > 0, `${label}.border is invalid.`);
  }
  for (const [index, shadow] of value.shadows.entries()) {
    for (const [name, number] of Object.entries(shadow).filter(([, item]) => typeof item === "number")) {
      finite(number as number, `${label}.shadows.${index}.${name}`);
    }
    assert(shadow.blurPx >= 0 && shadow.color.length > 0, `${label}.shadows.${index} is invalid.`);
  }
}

/**
 * Derive the area used by ordinary ContentFit. This is not a second authored
 * Frame: it is the deterministic inset of the Clip's one public Frame.
 */
export function visualContentFrame(frame: SpatialFrame, treatment: VisualFrameTreatment): SpatialFrame {
  assertSpatialFrame(frame);
  assertVisualFrameTreatment(treatment, "VisualFrameTreatment");
  const border = treatment.border?.widthPx ?? 0;
  const result = {
    xPx: frame.xPx + border + treatment.padding.leftPx,
    yPx: frame.yPx + border + treatment.padding.topPx,
    widthPx: frame.widthPx - border * 2 - treatment.padding.leftPx - treatment.padding.rightPx,
    heightPx: frame.heightPx - border * 2 - treatment.padding.topPx - treatment.padding.bottomPx,
  };
  assert(result.widthPx > 0 && result.heightPx > 0, "Visual treatment consumes its complete Frame.");
  assertSpatialFrame(result);
  return result;
}
