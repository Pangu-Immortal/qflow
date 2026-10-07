/** Exact author duration. Decimal source spelling is reduced before reaching this value. */
export type TemporalDuration =
  | { readonly unit: "frames"; readonly value: number }
  | { readonly unit: "milliseconds"; readonly value: number }
  | { readonly unit: "seconds"; readonly numerator: number; readonly denominator: number };

/** An authored coordinate on the Timeline itself, before exact resolution. */
export type TemporalInstantExpression =
  | { readonly ref: "timeline.start"; readonly offset?: TemporalDuration }
  | { readonly ref: "timeline.end"; readonly offset?: TemporalDuration }
  | { readonly ref: "absolute"; readonly at: TemporalDuration; readonly offset?: TemporalDuration };

/** Exact author parameter that owns one projected endpoint. Syntax owners may omit it for references. */
export type TemporalAuthorParameter = {
  readonly binding: string;
  readonly relation: "direct" | "after-start" | "before-end";
};

/** Input value for an Instant projection producer. */
export type TemporalInstantSpec = {
  readonly id: string;
  /** Author/domain entity whose timing this projection controls. */
  readonly subjectId: string;
  readonly projection: TemporalInstantExpression;
  /** Optional inverse declared by the author syntax that created this Spec. */
  readonly author?: TemporalAuthorParameter;
};

/** Input value for composing two resolved Instants into a Window. */
export type TemporalWindowSpec = {
  readonly id: string;
  /** Author/domain entity whose timing this projection controls. */
  readonly subjectId: string;
};

export type FrameSpan = {
  readonly startFrame: number;
  readonly endFrameExclusive: number;
};

/**
 * One resolved length on a discrete frame clock. It has no absolute position,
 * source identity, media role or Timeline ownership.
 */
export type TemporalExtent = {
  readonly frameRate: { readonly numerator: number; readonly denominator: number };
  readonly frameCount: number;
};

/** Identity and direction for shifting one resolved Instant by an exact Extent. */
export type TemporalShiftSpec = {
  readonly id: string;
  readonly subjectId: string;
  readonly direction: 1 | -1;
  /** Optional duration inverse declared by the author syntax that created this shift. */
  readonly author?: TemporalAuthorParameter;
};

/**
 * One finite, source-local frame coordinate system. A domain carries no media,
 * semantic events or presentation role; those packages retain their own facts
 * and refer to this identity when they need a common mapping authority.
 */
export type LocalTemporalDomain = {
  readonly id: string;
  readonly frameRate: { readonly numerator: number; readonly denominator: number };
  readonly frameCount: number;
};

/** A resolved absolute coordinate. Its derivation remains in the author graph. */
export type TemporalInstant = {
  readonly id: string;
  readonly subjectId: string;
  readonly timelineId: string;
  readonly frame: number;
};

export type TemporalWindow = {
  readonly id: string;
  readonly subjectId: string;
  readonly start: TemporalInstant;
  readonly end: TemporalInstant;
  readonly span: FrameSpan;
};

export type WindowRelation = "independent" | "disjoint";

export type TriggerPoint = {
  readonly id: string;
  readonly frame: number;
};

export type TriggeredSchedule = {
  readonly outer: FrameSpan;
  readonly terminalFrame: number;
  readonly cumulative: readonly FrameSpan[];
  readonly exclusive: readonly FrameSpan[];
};
