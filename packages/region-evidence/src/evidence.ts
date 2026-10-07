import type { CanonicalValue } from "@qflow/protocol";
import { assertSpatialFrame } from "@qflow/spatial";
import type { SpatialFrame } from "@qflow/spatial";
import type { Recipe } from "@qflow/recipe";
import { assertTimelineIdentity, timelineFrameCount } from "@qflow/timeline";
import type { Timeline } from "@qflow/timeline";

import type { RegionEvidence } from "./types.js";

type CanonicalRecord = Readonly<Record<string, CanonicalValue>>;

function record(value: CanonicalValue, label: string): CanonicalRecord {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error(`${label} must be a record.`);
  return value as CanonicalRecord;
}

function exact(value: CanonicalRecord, allowed: readonly string[], label: string): void {
  const unknown = Object.keys(value).find((name) => !allowed.includes(name));
  if (unknown !== undefined) throw new Error(`${label} does not accept ${unknown}.`);
}

function normalizedRegion(value: CanonicalValue, within: SpatialFrame, label: string): SpatialFrame | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length !== 4 || value.some((part) => typeof part !== "number" || !Number.isFinite(part))) {
    throw new Error(`${label} must be null or [x, y, width, height].`);
  }
  const [x, y, width, height] = value as unknown as readonly [number, number, number, number];
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
    throw new Error(`${label} must be a positive normalized region inside its Frame.`);
  }
  return {
    xPx: within.xPx + x * within.widthPx,
    yPx: within.yPx + y * within.heightPx,
    widthPx: width * within.widthPx,
    heightPx: height * within.heightPx,
  };
}

export function assertRegionEvidence(value: RegionEvidence): void {
  if (!value.timelineId.trim() || value.series.length === 0) {
    throw new Error("RegionEvidence is empty or has no Timeline identity.");
  }
  const frameCount = value.series[0]?.frames.length ?? 0;
  if (frameCount === 0) throw new Error("RegionEvidence has no Frames.");
  const ids = new Set<string>();
  for (const series of value.series) {
    if (!series.id.trim() || ids.has(series.id)) throw new Error(`RegionEvidence repeats or omits series id ${series.id}.`);
    ids.add(series.id);
    if (series.frames.length !== frameCount) throw new Error(`Region series ${series.id} does not cover every Frame.`);
    for (const frame of series.frames) if (frame !== null) assertSpatialFrame(frame);
  }
}

export function sealRegionEvidence(value: RegionEvidence): RegionEvidence {
  assertRegionEvidence(value);
  return structuredClone(value);
}

/** Resolve normalized author evidence into one program-picture Frame or null per Timeline Frame. */
export function resolveRegionEvidence(recipe: Recipe, within: SpatialFrame, timeline: Timeline): RegionEvidence {
  assertSpatialFrame(within);
  assertTimelineIdentity(timeline);
  exact(recipe.properties, ["series"], `Region Evidence ${recipe.path}`);
  const frameCount = timelineFrameCount(timeline);
  const seriesValue = recipe.properties.series;
  if (!Array.isArray(seriesValue) || seriesValue.length === 0) throw new Error(`${recipe.path}.series must be a non-empty list.`);
  const series = seriesValue.map((value, seriesIndex) => {
    const item = record(value, `${recipe.path}.series.${seriesIndex + 1}`);
    exact(item, ["id", "regions"], `${recipe.path}.series.${seriesIndex + 1}`);
    const id = item.id;
    if (typeof id !== "string" || !id.trim()) throw new Error(`${recipe.path}.series.${seriesIndex + 1}.id must be non-empty text.`);
    const regions = item.regions;
    if (!Array.isArray(regions) || regions.length !== frameCount) {
      throw new Error(`${recipe.path}.series.${seriesIndex + 1}.regions must contain exactly ${frameCount} Frames.`);
    }
    return {
      id,
      frames: regions.map((region, frame) => normalizedRegion(region, within, `${recipe.path}.${id}.regions.${frame}`)),
    };
  });
  return sealRegionEvidence({ timelineId: timeline.id, series });
}
