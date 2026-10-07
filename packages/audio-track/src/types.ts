import type { AudioSourceTimeMap, AudioSourceTimeRational, FrameSpan } from "@qflow/qflow/composition";
import type { BlobRef } from "@qflow/qflow/protocol";
import type {
  TemporalDuration,
} from "@qflow/qflow/temporal";

export type AudioSourceTimePoint = {
  readonly edge: "start" | "end";
  /** Non-negative distance inward from the named edge. */
  readonly offset: TemporalDuration;
};

export type AudioSourceTimeBounds = {
  readonly from: AudioSourceTimePoint;
  readonly until: AudioSourceTimePoint;
};

export type AudioSourceTimeRelation =
  | {
      readonly kind: "rate";
      readonly target: AudioSourceTimeBounds;
      readonly targetAt: AudioSourceTimePoint;
      readonly sourceAt: AudioSourceTimePoint;
      readonly rate: AudioSourceTimeRational;
      readonly source: AudioSourceTimeBounds;
      readonly wrap?: AudioSourceTimeBounds;
    }
  | {
      readonly kind: "fit";
      readonly target: AudioSourceTimeBounds;
      readonly source: AudioSourceTimeBounds;
      /** Audio-specific safety bounds for the pitch-preserving tempo ratio. */
      readonly minRate?: number;
      readonly maxRate?: number;
    };

export type AudioSourceTimeSpec = {
  readonly relations: readonly AudioSourceTimeRelation[];
};

export type AudioClipMix = {
  readonly gain: number;
  readonly fadeIn: TemporalDuration;
  readonly fadeOut: TemporalDuration;
};

export type AudioClipSpec = {
  readonly id: string;
  /** Omission means bounded partial identity. */
  readonly sourceTime?: AudioSourceTimeSpec;
  readonly mix: AudioClipMix;
};

export type AudioTrackHeader = {
  readonly id: string;
};

export type AudioClipProgram = {
  readonly id: string;
  /** Author-owned Clip realized by this absolute destination Window. */
  readonly subjectId: string;
  readonly window: FrameSpan;
  readonly source: {
    readonly artifact: BlobRef;
    readonly sampleFrames: number;
  };
  readonly sourceTime: AudioSourceTimeSpec;
  readonly mix: {
    readonly gain: number;
    readonly fadeInSamples: number;
    readonly fadeOutSamples: number;
  };
};

export type AudioTrackProgram = {
  readonly id: string;
  readonly clips: readonly AudioClipProgram[];
};

export type AudioTrackSet = {
  readonly clips: readonly AudioClipProgram[];
};
