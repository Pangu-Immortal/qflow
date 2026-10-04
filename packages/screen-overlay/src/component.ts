import type { Timeline } from "@qflow/timeline";
import type { ComponentPackage } from "@qflow/component-kit";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import type { SpatialFrame } from "@qflow/spatial";
import { screenOverlayProducers, screenOverlayTypes } from "./manifest.js";
import { appendProjectedScreenOverlay, assertScreenOverlayProgram, createScreenOverlaySet, finalizeScreenOverlay, renderScreenOverlay } from "./program.js";
import type { ScreenOverlayHeader, ScreenOverlayItemSpec, ScreenOverlayProgram, ScreenOverlaySet } from "./types.js";
import type { TemporalWindow } from "@qflow/temporal";
function inline<T>(value: StoredValue | undefined, label: string): T { if (value?.kind !== "inline") throw new Error(`${label} must be inline.`); return value.value as unknown as T; }
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });
export const screenOverlayComponent = {
  producers: [
    { producer: screenOverlayProducers.createSet, handler: () => ({ outputs: { set: output(createScreenOverlaySet()) }, needs: {} }) },
    { producer: screenOverlayProducers.appendItem, handler: ({ inputs }) => ({ outputs: { set: output(appendProjectedScreenOverlay(inline<ScreenOverlaySet>(inputs.set?.value, "ScreenOverlaySet"), inline<ScreenOverlayHeader>(inputs.header?.value, "ScreenOverlayHeader"), inline<Timeline>(inputs.timeline?.value, "Timeline"), inline<ScreenOverlayItemSpec>(inputs.spec?.value, "ScreenOverlayItemSpec"), inline<TemporalWindow>(inputs.window?.value, "TemporalWindow"))) }, needs: {} }) },
    { producer: screenOverlayProducers.finalize, handler: ({ inputs }) => ({ outputs: { program: output(finalizeScreenOverlay(inline<ScreenOverlaySet>(inputs.set?.value, "ScreenOverlaySet"), inline<ScreenOverlayHeader>(inputs.header?.value, "ScreenOverlayHeader"))) }, needs: {} }) },
    { producer: screenOverlayProducers.render, handler: ({ inputs }) => ({ outputs: { track: output(renderScreenOverlay(inline<SpatialFrame>(inputs.within?.value, "SpatialFrame"), inline<Timeline>(inputs.timeline?.value, "Timeline"), inline<ScreenOverlayProgram>(inputs.program?.value, "ScreenOverlayProgram"))) }, needs: {} }) },
  ],
  validators: [{ type: screenOverlayTypes.program, handler: ({ value }) => assertScreenOverlayProgram(inline<ScreenOverlayProgram>(value, "ScreenOverlayProgram")) }],
} satisfies ComponentPackage;
