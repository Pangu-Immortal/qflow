import {
  assertExactAttributes,
  localName,
  textAttribute,
} from "@qflow/markup";
import type {
  MarkupAttributeValue,
  StructuredElement,
  StructuredSurfaceHandler,
  SurfaceResolvedReference,
} from "@qflow/markup";
import { narrativeTypes } from "@qflow/narrative";
import type { NarrativeMomentRef } from "@qflow/narrative";
import { canonicalize, sameType } from "@qflow/protocol";
import { narrativeTemporalTypes } from "@qflow/narrative-temporal";
import { temporalTypes } from "@qflow/temporal";

import { narrativeAlignmentAdjustFragment } from "./fragment.js";
import { narrativeAlignmentAdjustTypes } from "./manifest.js";
import type { NarrativeAlignmentAdjustmentPlan } from "./types.js";

function reference(
  element: StructuredElement,
  name: string,
  expected: SurfaceResolvedReference["type"],
  resolveReference: (path: string) => SurfaceResolvedReference | undefined,
): SurfaceResolvedReference {
  const raw: MarkupAttributeValue | undefined = element.attributes[name];
  if (typeof raw !== "object" || raw.kind !== "reference") {
    throw new Error(`${element.name}.${name} must be a whole-value reference.`);
  }
  const resolved = resolveReference(raw.path);
  if (resolved === undefined) throw new Error(`${element.name}.${name} cannot resolve ${raw.path}.`);
  if (!sameType(resolved.type, expected)) throw new Error(`${element.name}.${name} has the wrong type.`);
  return resolved;
}

function inline<T>(value: SurfaceResolvedReference, subject: string): T {
  if (value.record?.value.kind !== "inline") throw new Error(`${subject} must reference an authored inline Record.`);
  return value.record.value.value as unknown as T;
}

function frameAttribute(element: StructuredElement): number {
  const value = Number(textAttribute(element, "frame"));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${element.name}.frame must be a non-negative integer.`);
  return value;
}

export const decodeNarrativeAlignmentAdjustSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertExactAttributes(element, ["id", "source", "domain"]);
  const id = textAttribute(element, "id");
  const source = reference(element, "source", narrativeTemporalTypes.narrativeAlignment, resolveReference);
  const domain = reference(element, "domain", temporalTypes.localDomain, resolveReference);
  const moments: NarrativeMomentRef[] = [];
  const boundaries: NarrativeAlignmentAdjustmentPlan["boundaries"][number][] = [];

  for (const child of element.children) {
    if (child.kind === "text") {
      if (child.value.trim()) throw new Error(`${element.name} accepts only Boundary children.`);
      continue;
    }
    if (localName(child.name) !== "Boundary") throw new Error(`${element.name} accepts only Boundary children.`);
    assertExactAttributes(child, ["at", "frame"]);
    if (child.children.some((item) => item.kind === "element" || item.value.trim())) {
      throw new Error(`${child.name} must be empty.`);
    }
    const moment = inline<NarrativeMomentRef>(
      reference(child, "at", narrativeTypes.moment, resolveReference),
      `${child.name}.at`,
    );
    moments.push(moment);
    boundaries.push({ boundaryId: moment.anchorId, frame: frameAttribute(child) });
  }
  if (boundaries.length === 0) throw new Error(`${element.name} requires at least one Boundary child.`);
  const narrativeId = moments[0]!.narrativeId;
  if (moments.some((moment) => moment.narrativeId !== narrativeId)) {
    throw new Error(`${element.name} cannot mix Moments from different Narratives.`);
  }

  const planId = `${id}.plan`;
  const plan: NarrativeAlignmentAdjustmentPlan = { narrativeId, boundaries };
  return {
    records: [{
      id: planId,
      type: narrativeAlignmentAdjustTypes.plan,
      value: { kind: "inline", value: canonicalize(plan) },
      range: element.range,
    }],
    components: [{
      id,
      fragment: narrativeAlignmentAdjustFragment.id,
      inputs: { source: source.ref, domain: domain.ref, plan: { kind: "record", id: planId } },
      outputs: { alignment: `${id}.alignment` },
      range: element.range,
    }],
    fragments: [narrativeAlignmentAdjustFragment],
  };
};
