import { assertNarrativeAlignmentIdentity, sealNarrativeAlignment } from "@qflow/narrative-temporal";
import type { NarrativeAlignment } from "@qflow/narrative-temporal";
import { assertLocalTemporalDomain } from "@qflow/temporal";
import type { LocalTemporalDomain } from "@qflow/temporal";

import type { NarrativeAlignmentAdjustmentPlan } from "./types.js";

export function adjustNarrativeAlignment(
  source: NarrativeAlignment,
  domain: LocalTemporalDomain,
  plan: NarrativeAlignmentAdjustmentPlan,
): NarrativeAlignment {
  assertLocalTemporalDomain(domain);
  assertNarrativeAlignmentIdentity(source, domain);
  if (plan.narrativeId !== source.narrativeId) {
    throw new Error(`NarrativeAlignment adjustment belongs to Narrative ${plan.narrativeId}, not ${source.narrativeId}.`);
  }
  if (plan.boundaries.length === 0) throw new Error("NarrativeAlignment adjustment requires at least one boundary.");

  const sourceBoundaryIds = new Set(source.boundaries.map((boundary) => boundary.id));
  const adjusted = new Map<string, number>();
  for (const boundary of plan.boundaries) {
    if (!sourceBoundaryIds.has(boundary.boundaryId)) {
      throw new Error(`NarrativeAlignment does not contain boundary ${boundary.boundaryId}.`);
    }
    if (adjusted.has(boundary.boundaryId)) {
      throw new Error(`NarrativeAlignment boundary ${boundary.boundaryId} is adjusted more than once.`);
    }
    if (!Number.isSafeInteger(boundary.frame) || boundary.frame < 0 || boundary.frame > domain.frameCount) {
      throw new Error(`NarrativeAlignment boundary ${boundary.boundaryId} has an invalid adjusted frame.`);
    }
    adjusted.set(boundary.boundaryId, boundary.frame);
  }

  return sealNarrativeAlignment({
    ...source,
    boundaries: source.boundaries.map((boundary) => ({
      ...boundary,
      frame: adjusted.get(boundary.id) ?? boundary.frame,
    })),
  }, domain);
}
