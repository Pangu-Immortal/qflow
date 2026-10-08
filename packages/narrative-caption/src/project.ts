import { assertCaptionDocumentIdentity, assertCaptionTimingForDocument } from "@qflow/caption";
import type { CaptionDocument, CaptionTiming, CaptionTimingUnit } from "@qflow/caption";
import type { NarrativeProjection } from "@qflow/narrative-temporal";

import type { NarrativeCaptionBinding } from "./types.js";
import { NarrativeCaptionTimingError } from "./error.js";
import { assertNarrativeCaptionBindingIdentity } from "./identity.js";

export function projectNarrativeCaptionTiming(
  document: CaptionDocument,
  binding: NarrativeCaptionBinding,
  projection: NarrativeProjection,
): CaptionTiming {
  assertCaptionDocumentIdentity(document);
  assertNarrativeCaptionBindingIdentity(binding);
  if (binding.documentId !== document.id || binding.narrativeId !== projection.narrativeId) {
    throw new NarrativeCaptionTimingError("CAPTION_BINDING", "Caption binding disagrees with its document or NarrativeProjection.");
  }
  const bindings = new Map(binding.units.map((unit) => [unit.unitId, unit.sourceTokenIds] as const));
  const documentIds = new Set(document.units.map((unit) => unit.id));
  const missingBinding = document.units.find((unit) => !bindings.has(unit.id));
  const unknownBinding = binding.units.find((unit) => !documentIds.has(unit.unitId));
  if (missingBinding !== undefined || unknownBinding !== undefined || bindings.size !== documentIds.size) {
    const path = missingBinding === undefined ? unknownBinding!.unitId : missingBinding.id;
    throw new NarrativeCaptionTimingError("CAPTION_BINDING",
      `CaptionDocument ${document.id} -> Binding ${binding.id} does not connect Unit ${path} exactly.`);
  }
  const tokens = new Map(projection.tokens.map((token) => [token.tokenId, token] as const));
  const boundaries = new Map(projection.boundaries.map((boundary) => [boundary.id, boundary.frame] as const));
  const timed: CaptionTimingUnit[] = [];
  for (const unit of document.units) {
    const sourceTokenIds = bindings.get(unit.id)!;
    const sourceTokens = sourceTokenIds.map((tokenId) => {
      const token = tokens.get(tokenId);
      if (token === undefined) {
        throw new NarrativeCaptionTimingError("CAPTION_PROJECTION",
          `CaptionDocument ${document.id} -> Unit ${unit.id} -> Binding ${binding.id} -> Token ${tokenId} is absent from NarrativeProjection ${projection.id}.`);
      }
      return token;
    });
    const first = sourceTokens[0]!;
    const last = sourceTokens.at(-1)!;
    const startFrame = boundaries.get(first.startBoundaryId);
    if (startFrame === undefined) {
      throw new NarrativeCaptionTimingError("CAPTION_PROJECTION",
        `CaptionDocument ${document.id} -> Unit ${unit.id} -> Token ${first.tokenId} -> Boundary ${first.startBoundaryId} is absent from NarrativeProjection ${projection.id}.`);
    }
    const endFrameExclusive = boundaries.get(last.endBoundaryId);
    if (endFrameExclusive === undefined) {
      throw new NarrativeCaptionTimingError("CAPTION_PROJECTION",
        `CaptionDocument ${document.id} -> Unit ${unit.id} -> Token ${last.tokenId} -> Boundary ${last.endBoundaryId} is absent from NarrativeProjection ${projection.id}.`);
    }
    if (endFrameExclusive <= startFrame) {
      throw new NarrativeCaptionTimingError("CAPTION_UNIT_WINDOW",
        `CaptionDocument ${document.id} -> Unit ${unit.id} resolves to invalid absolute boundaries ${startFrame}..${endFrameExclusive} on Timeline ${projection.timelineId}.`);
    }
    timed.push({ unitId: unit.id, startFrame, endFrameExclusive });
  }
  const result: CaptionTiming = { timelineId: projection.timelineId, documentId: document.id, units: timed };
  assertCaptionTimingForDocument(result, document);
  return result;
}
