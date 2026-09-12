import type { ProgramSpace } from "@qflow/program-space";
import type { SemanticTake } from "@qflow/speech";

export type TimelineItem = {
  readonly take: SemanticTake;
  readonly startFrame: number;
};

/** One complete film time range, with prepared material placed where it belongs. */
export type Timeline = ProgramSpace & {
  readonly narrativeId?: string;
  readonly items: readonly TimelineItem[];
};

export type TimelineSpan = {
  readonly item: TimelineItem;
  readonly startFrame: number;
  readonly endFrameExclusive: number;
};

export type LocatedFrameSpan = {
  readonly startFrame: number;
  readonly endFrameExclusive: number;
};
