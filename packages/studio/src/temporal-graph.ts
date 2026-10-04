import { sameType } from "@qflow/protocol";
import type { BuildState, ProducerStep, StoredValue, TypedRecord } from "@qflow/protocol";
import { temporalModuleRef, temporalTypes } from "@qflow/temporal";
import type {
  StudioTemporalBinding,
  StudioTemporalInstantProjection,
  StudioTemporalProjection,
} from "@qflow/studio-adapter";

type PointExpression = {
  readonly ref?: string;
  readonly offset?: unknown;
  readonly at?: unknown;
};

function inline(value: StoredValue): unknown | undefined {
  return value.kind === "inline" ? value.value : undefined;
}

function duration(value: unknown): string {
  const item = value as {
    readonly unit?: string;
    readonly value?: number;
    readonly numerator?: number;
    readonly denominator?: number;
  } | undefined;
  if (item?.unit === "frames") return `${item.value ?? 0}f`;
  if (item?.unit === "milliseconds") return `${item.value ?? 0}ms`;
  if (item?.unit === "seconds") return item.denominator === 1
    ? `${item.numerator ?? 0}s`
    : `${item.numerator ?? 0}/${item.denominator ?? 1}s`;
  return "?";
}

function signed(value: unknown): string {
  const item = value as { readonly unit?: string; readonly value?: number; readonly numerator?: number } | undefined;
  if (item === undefined) return "+?";
  const negative = item.unit === "seconds" ? (item.numerator ?? 0) < 0 : (item.value ?? 0) < 0;
  if (!negative) return `+${duration(value)}`;
  return item.unit === "seconds"
    ? `-${duration({ ...item, numerator: Math.abs(item.numerator ?? 0) })}`
    : `-${duration({ ...item, value: Math.abs(item.value ?? 0) })}`;
}

function expression(value: unknown): string {
  const point = value as PointExpression;
  if (point.ref === "absolute") return `${duration(point.at)}${point.offset === undefined ? "" : signed(point.offset)}`;
  if (typeof point.ref !== "string") return "?";
  return point.offset === undefined ? point.ref : `${point.ref}${signed(point.offset)}`;
}

function instant(
  record: TypedRecord | undefined,
  records: ReadonlyMap<string, TypedRecord>,
  producers: ReadonlyMap<string, ProducerStep>,
  fallback?: unknown,
): StudioTemporalInstantProjection | undefined {
  const value = record === undefined ? fallback : inline(record.value);
  const held = value as {
    readonly id?: unknown;
    readonly timelineId?: unknown;
    readonly frame?: unknown;
  } | undefined;
  if (typeof held?.id !== "string" || typeof held.timelineId !== "string" || !Number.isSafeInteger(held.frame)) return undefined;
  const step = record === undefined ? undefined : producers.get(record.id);
  const specRecord = step?.inputs.spec === undefined ? undefined : records.get(step.inputs.spec);
  const spec = specRecord === undefined ? undefined : inline(specRecord.value) as {
    readonly projection?: PointExpression;
    readonly reference?: unknown;
    readonly boundary?: unknown;
    readonly offset?: unknown;
  } | undefined;
  if (step?.producer.module.name === temporalModuleRef.name
    && step.producer.module.version === temporalModuleRef.version
    && step.producer.name === "project-program-instant"
    && spec?.projection !== undefined) {
    const timelineRecord = step.inputs.timeline === undefined ? undefined : records.get(step.inputs.timeline);
    const timeline = timelineRecord === undefined ? undefined : inline(timelineRecord.value) as { readonly id?: unknown } | undefined;
    const reference = spec.projection.ref;
    if (typeof reference !== "string") return undefined;
    return {
      kind: "instant",
      expression: expression(spec.projection),
      reference,
      frame: held.frame as number,
      source: { timelineId: held.timelineId, type: timelineRecord?.type ?? record!.type,
        kind: "timeline", id: typeof timeline?.id === "string" ? timeline.id : held.timelineId },
      authority: { kind: "fixed" },
    };
  }
  if (step !== undefined) {
    const domainInput = Object.entries(step.inputs).find(([name]) =>
      name !== "timeline" && name !== "projection" && name !== "spec");
    if (domainInput !== undefined) {
      const [kind, sourceId] = domainInput;
      const sourceRecord = records.get(sourceId);
      const sourceValue = sourceRecord === undefined ? undefined : inline(sourceRecord.value) as {
        readonly id?: unknown; readonly narrativeId?: unknown;
      } | undefined;
      const boundary = typeof spec?.boundary === "string" ? spec.boundary : "point";
      const reference = typeof spec?.reference === "string"
        ? spec.reference
        : `${kind}.${boundary === "cue" ? "cue" : boundary}`;
      const point = { ref: reference, ...(spec?.offset === undefined ? {} : { offset: spec.offset }) };
      if (sourceRecord !== undefined && typeof sourceValue?.id === "string") return {
        kind: "instant",
        expression: expression(point),
        reference,
        frame: held.frame as number,
        source: { timelineId: held.timelineId, type: sourceRecord.type, kind, id: sourceValue.id,
          ...(typeof sourceValue.narrativeId === "string" ? { narrativeId: sourceValue.narrativeId } : {}) },
        authority: { kind: "domain", source: { timelineId: held.timelineId, type: sourceRecord.type,
          kind, id: sourceValue.id,
          ...(typeof sourceValue.narrativeId === "string" ? { narrativeId: sourceValue.narrativeId } : {}) }, boundary },
      };
    }
  }
  const type = record?.type ?? temporalTypes.instant;
  return {
    kind: "instant",
    expression: `${held.frame as number}f`,
    reference: "absolute",
    frame: held.frame as number,
    source: { timelineId: held.timelineId, type, kind: "resolved", id: held.id },
    authority: { kind: "fixed" },
  };
}

function projection(
  record: TypedRecord,
  records: ReadonlyMap<string, TypedRecord>,
  producers: ReadonlyMap<string, ProducerStep>,
): {
  readonly id: string;
  readonly subjectId: string;
  readonly projection: StudioTemporalProjection;
} | undefined {
  const held = inline(record.value) as {
    readonly id?: unknown;
    readonly subjectId?: unknown;
    readonly start?: unknown;
    readonly end?: unknown;
    readonly span?: { readonly startFrame?: unknown; readonly endFrameExclusive?: unknown };
  } | undefined;
  if (typeof held?.id !== "string" || typeof held.subjectId !== "string") return undefined;
  if (sameType(record.type, temporalTypes.instant)) {
    const projected = instant(record, records, producers);
    return projected === undefined ? undefined : { id: held.id, subjectId: held.subjectId, projection: projected };
  }
  const step = producers.get(record.id);
  const startRecord = step?.inputs.start === undefined ? undefined : records.get(step.inputs.start);
  const endRecord = step?.inputs.end === undefined ? undefined : records.get(step.inputs.end);
  const start = instant(startRecord, records, producers, held.start);
  const end = instant(endRecord, records, producers, held.end);
  if (start === undefined || end === undefined) return undefined;
  if (!Number.isSafeInteger(held.span?.startFrame) || !Number.isSafeInteger(held.span?.endFrameExclusive)) return undefined;
  return {
    id: held.id,
    subjectId: held.subjectId,
    projection: {
      kind: "window",
      start,
      end,
      startFrame: held.span!.startFrame as number,
      endFrameExclusive: held.span!.endFrameExclusive as number,
    },
  };
}

function recordIndex(state: BuildState): ReadonlyMap<string, TypedRecord> {
  return new Map([...state.program.records, ...state.records].map((record) => [record.id, record] as const));
}

function producingSteps(state: BuildState): ReadonlyMap<string, ProducerStep> {
  return new Map(state.plan.steps.flatMap((step) =>
    Object.values(step.outputs).map((record) => [record, step] as const)));
}

function closure(state: BuildState, output: string): ReadonlySet<string> {
  const selected = state.plan.outputBindings.find((selection) => selection.output === output);
  if (selected === undefined) return new Set();
  const producers = producingSteps(state);
  const steps = new Set<string>();
  const records = new Set<string>();
  const visit = (record: string): void => {
    if (records.has(record)) return;
    records.add(record);
    const step = producers.get(record);
    if (step === undefined || steps.has(step.id)) return;
    steps.add(step.id);
    for (const input of Object.values(step.inputs)) visit(input);
  };
  visit(selected.record);
  return steps;
}

/**
 * Read Temporal lineage from the exact executed dependency closure of one
 * logical output. Projection and consumption are graph facts; source markup is
 * deliberately not consulted here.
 */
export function executedTemporalBindings(
  state: BuildState,
  output: string,
): readonly StudioTemporalBinding[] {
  const records = recordIndex(state);
  const producers = producingSteps(state);
  const stepIds = closure(state, output);
  const steps = state.plan.steps.filter((step) => stepIds.has(step.id));
  return [...records.values()]
    .filter((record) => sameType(record.type, temporalTypes.instant) || sameType(record.type, temporalTypes.window))
    .flatMap((record): readonly StudioTemporalBinding[] => {
      const projected = projection(record, records, producers);
      if (projected === undefined) return [];
      const consumers = steps.flatMap((step) => Object.entries(step.inputs)
        .filter(([, input]) => input === record.id)
        .map(([input]) => ({
          step: step.id,
          producer: { module: { ...step.producer.module }, name: step.producer.name },
          input,
          role: step.producer.module.name === temporalModuleRef.name
            && step.producer.module.version === temporalModuleRef.version
            ? "projection" as const
            : "domain" as const,
          inputs: Object.entries(step.inputs).flatMap(([name, id]) => {
            const found = records.get(id);
            if (found === undefined) return [];
            const value = inline(found.value);
            return [{
              name,
              record: id,
              type: { module: { ...found.type.module }, name: found.type.name },
              ...(value === undefined ? {} : { value: structuredClone(value) }),
            }];
          }).sort((left, right) => left.name.localeCompare(right.name)),
        })));
      if (consumers.length === 0) return [];
      return [{
        record: record.id,
        ...projected,
        consumers: consumers.sort((left, right) => left.step.localeCompare(right.step)
          || left.input.localeCompare(right.input)),
      }];
    })
    .sort((left, right) => left.record.localeCompare(right.record));
}
