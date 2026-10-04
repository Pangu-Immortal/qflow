export type NarrativeBoundaryAdjustment = {
  readonly boundaryId: string;
  readonly frame: number;
};

export type NarrativeAlignmentAdjustmentPlan = {
  readonly narrativeId: string;
  readonly boundaries: readonly NarrativeBoundaryAdjustment[];
};
