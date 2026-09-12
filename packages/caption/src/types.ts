import type { CanonicalValue } from "@qflow/protocol";

export type CaptionStyleIntent = {
  readonly id: string;
  /** null selects no rendering; later Uses can select a visible Style again. */
  readonly rendering: {
    readonly family: string;
    readonly parameters: CanonicalValue;
  } | null;
};

/** Ordered, resolved Uses owned by a Caption Track, not a separate author element. */
export type CaptionUse = {
  readonly window: import("@qflow/temporal").TemporalWindow;
  readonly styleId: string;
  readonly role?: string;
};
export type CaptionProgram = {
  readonly id: string;
  readonly documentId: string;
  readonly styles: readonly CaptionStyleIntent[];
  readonly uses: readonly CaptionUse[];
};

export type TimedCaptionUnit = {
  readonly unitId: string;
  readonly startFrame: number;
  readonly endFrameExclusive: number;
};

export type TimedCaptionCue = {
  readonly id: string;
  readonly startFrame: number;
  readonly endFrameExclusive: number;
  readonly units: readonly TimedCaptionUnit[];
};

export type TimedCaptionProjection = {
  /** Semantic Timeline from which every unit frame was measured. */
  readonly spaceId: string;
  readonly narrativeId: string;
  readonly documentId: string;
  readonly cues: readonly TimedCaptionCue[];
};
