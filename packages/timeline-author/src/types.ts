import type { TemporalDuration } from "@qflow/temporal";

export type TimelineAuthorHeader = { readonly id: string };
export type ConstructionPoint = { readonly frame: number };
export type ConstructionExtent = { readonly frameCount: number };
export type ConstructionSpan = { readonly startFrame: number; readonly endFrameExclusive: number };
export type ConstructionOffsetSpec = { readonly direction: 1 | -1 };
export type ConstructionIdentitySpec = { readonly id: string; readonly subjectId?: string };
export type ConstructionDurationSpec = TemporalDuration;

export type TimelineInstantDeclaration = {
  readonly id: string;
  readonly kind: "instant";
  readonly at: string;
};
export type TimelineWindowDeclaration = {
  readonly id: string;
  readonly kind: "window";
  readonly from?: string;
  readonly until?: string;
  readonly duration?: string;
  readonly extentInput?: string;
};
export type TimelineAuthorDeclaration = TimelineInstantDeclaration | TimelineWindowDeclaration;

export type TimelineAuthorFragmentOptions = {
  readonly id: string;
  readonly end: string;
  readonly declarations: readonly TimelineAuthorDeclaration[];
};
