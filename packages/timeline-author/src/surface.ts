import {
  assertAttributes,
  assertEmptyElement,
  localName,
  textAttribute,
  type StructuredElement,
  type StructuredSurfaceHandler,
  type SurfaceResolvedReference,
} from "@qflow/markup";
import { canonicalize, sameType } from "@qflow/protocol";
import { temporalTypes } from "@qflow/temporal";
import {
  createTemporalInstantConstruction,
  createTemporalWindowConstruction,
  resolveTemporalContext,
} from "@qflow/temporal-markup";
import { timelineTypes } from "@qflow/timeline";

import { compileTimelineAuthorFragment } from "./fragment.js";
import { timelineAuthorTypes } from "./manifest.js";
import type { TimelineAuthorDeclaration } from "./types.js";

function reference(
  element: StructuredElement,
  name: string,
  type: SurfaceResolvedReference["type"],
  resolveReference: (path: string) => SurfaceResolvedReference | undefined,
): SurfaceResolvedReference {
  const raw = element.attributes[name];
  if (typeof raw !== "object" || raw.kind !== "reference") throw new Error(`${element.name}.${name} must be a reference.`);
  const found = resolveReference(raw.path);
  if (found === undefined || !sameType(found.type, type)) throw new Error(`${element.name}.${name} has the wrong Type.`);
  return found;
}

function optionalPointExpression(element: StructuredElement, name: string): string | undefined {
  const raw = element.attributes[name];
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${element.name}.${name} must be a Timeline Point expression.`);
  }
  return raw.trim();
}

export const decodeTimelineAuthorSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "clock", "end"]);
  const id = textAttribute(element, "id");
  const clock = reference(element, "clock", timelineTypes.clock, resolveReference);
  const end = textAttribute(element, "end");
  const extentReferences = new Map<string, SurfaceResolvedReference>();
  const declarations: TimelineAuthorDeclaration[] = [];

  for (const [index, child] of element.children.entries()) {
    if (child.kind === "text") {
      if (child.value.trim()) throw new Error(`${element.name} accepts only Instant and Window children.`);
      continue;
    }
    const tag = localName(child.name);
    if (tag === "Instant") {
      assertAttributes(child, ["id", "at"]);
      assertEmptyElement(child);
      declarations.push({ id: textAttribute(child, "id"), kind: "instant", at: textAttribute(child, "at") });
      continue;
    }
    if (tag === "Window") {
      assertAttributes(child, ["id", "from", "until", "for"], ["id"]);
      assertEmptyElement(child);
      const declarationId = textAttribute(child, "id");
      const rawFor = child.attributes.for;
      let duration: string | undefined;
      let extentInput: string | undefined;
      if (typeof rawFor === "string") duration = rawFor.trim();
      else if (rawFor !== undefined) {
        const found = reference(child, "for", temporalTypes.extent, resolveReference);
        extentInput = `extent-${index + 1}`;
        extentReferences.set(extentInput, found);
      }
      const from = optionalPointExpression(child, "from");
      const until = optionalPointExpression(child, "until");
      declarations.push({
        id: declarationId,
        kind: "window",
        ...(from === undefined ? {} : { from }),
        ...(until === undefined ? {} : { until }),
        ...(duration === undefined ? {} : { duration }),
        ...(extentInput === undefined ? {} : { extentInput }),
      });
      continue;
    }
    throw new Error(`${element.name} accepts only Instant and Window children.`);
  }

  const plan = compileTimelineAuthorFragment({ id, end, declarations });
  const headerRecord = `${id}.__header`;
  const records = [{ id: headerRecord, type: timelineAuthorTypes.header,
    value: { kind: "inline" as const, value: canonicalize({ id }) }, range: element.range },
  ...plan.inlineInputs.map((item) => ({ id: `${id}.__${item.name}`, type: item.type,
    value: { kind: "inline" as const, value: canonicalize(item.value) }, range: element.range }))];
  const inputs = {
    header: { kind: "record" as const, id: headerRecord },
    clock: clock.ref,
    ...Object.fromEntries(plan.inlineInputs.map((item) => [item.name, { kind: "record" as const, id: `${id}.__${item.name}` }])),
    ...Object.fromEntries(plan.extentInputs.map((item) => {
      const extent = extentReferences.get(item.name);
      if (extent === undefined) throw new Error(`Timeline Window ${item.declarationId} has no resolved Extent.`);
      return [item.name, extent.ref];
    })),
  };
  const outputs = Object.fromEntries(plan.outputNames.map((item) => [item.port, `${id}.${item.suffix}`]));
  return {
    records,
    fragments: [plan.fragment],
    components: [{ id, fragment: plan.fragment.id, inputs, outputs, range: element.range }],
    exports: Object.values(outputs),
  };
};

export const decodeClockSurface: StructuredSurfaceHandler = ({ element }) => {
  assertAttributes(element, ["id", "frame-rate"]); assertEmptyElement(element);
  const id = textAttribute(element, "id");
  const raw = textAttribute(element, "frame-rate");
  const match = /^(\d+)(?:\/(\d+))?$/u.exec(raw);
  if (match === null) throw new Error(`${element.name}.frame-rate must be a positive rational.`);
  const numerator = Number(match[1]);
  const denominator = Number(match[2] ?? 1);
  if (!Number.isSafeInteger(numerator) || numerator < 1 || !Number.isSafeInteger(denominator) || denominator < 1) {
    throw new Error(`${element.name}.frame-rate must be a positive rational.`);
  }
  const value = { frameRate: { numerator, denominator } };
  return { records: [{ id, type: timelineTypes.clock, value: { kind: "inline", value: canonicalize(value) }, range: element.range }],
    components: [], fragments: [], exports: [id] };
};

/** Publish one reusable absolute Window independently of Timeline construction and consumers. */
export const decodeAbsoluteWindowSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "from", "until", "for"], ["id", "timeline"]);
  assertEmptyElement(element);
  const id = textAttribute(element, "id");
  const context = resolveTemporalContext({ element, resolveReference });
  const construction = createTemporalWindowConstruction({ id, element, ...context, resolveReference });
  if (construction.startRef === undefined || construction.endRef === undefined || construction.components.length !== 1) {
    throw new Error(`${element.name} must construct a Window from exactly two of from, until and for.`);
  }
  const component = construction.components[0]!;
  return {
    records: construction.records,
    fragments: construction.fragments,
    components: [{ ...component, outputs: { window: id, start: `${id}.start`, end: `${id}.end` } }],
    exports: [id, `${id}.start`, `${id}.end`],
  };
};

/** Publish one reusable authored absolute Instant. Existing Instants can be referenced directly. */
export const decodeAbsoluteInstantSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  assertAttributes(element, ["id", "timeline", "at"], ["id", "timeline", "at"]);
  assertEmptyElement(element);
  if (typeof element.attributes.at !== "string") {
    throw new Error(`${element.name}.at must be an authored absolute expression; reference an existing Instant directly.`);
  }
  const id = textAttribute(element, "id");
  const context = resolveTemporalContext({ element, resolveReference });
  const construction = createTemporalInstantConstruction({ id, element, ...context, resolveReference });
  if (construction.components.length !== 1) throw new Error(`${element.name} did not construct an Instant.`);
  const component = construction.components[0]!;
  return {
    records: construction.records,
    fragments: construction.fragments,
    components: [{ ...component, outputs: { instant: id } }],
    exports: [id],
  };
};
