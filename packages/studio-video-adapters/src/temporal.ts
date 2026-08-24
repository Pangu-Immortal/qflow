import type { StudioAdapterContext, StudioTemporalLineage } from "@qflow/studio-adapter";
import { temporalLineageFor } from "@qflow/studio-adapter";

/** Resolve a domain item's Window from the executed edge that consumed it. */
export function itemTemporalLineage(
  context: StudioAdapterContext,
  runtimeId: string,
  input = "window",
): StudioTemporalLineage | undefined {
  return temporalLineageFor(context, runtimeId, input);
}
