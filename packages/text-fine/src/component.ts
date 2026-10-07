import type { Timeline } from "@qflow/qflow/timeline";
import type { ProducerPackage } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import type { StoredValue } from "@qflow/qflow/protocol";
import type { CompositableSurfaceRef } from "@qflow/qflow/media";
import type { SpatialFrame, SpatialPath, SpatialPoint } from "@qflow/qflow/spatial";
import type { Text } from "@qflow/qflow/text";
import { canonicalize } from "@qflow/qflow/protocol";

import { textFineProducers } from "./manifest.js";
import { bindAreaTextPlacement, bindPathTextPlacement, bindPointTextPlacement, createFineTextOccurrence, renderFineTextMask, renderFineTextOccurrence, materializePlainTextItem } from "./program.js";
import type {
  FineTextOccurrence,
  TextItemSpec,
  PlainTextItemSpec,
  TextPlacement,
  TextFlowPlacementPolicy,
  TextMotion,
  TextPathMotion,
  TextPathPlacementPolicy,
  TextPointPlacementPolicy,
  TextMaskSpec,
  TextStyle,
} from "./types.js";
import type { TemporalWindow } from "@qflow/qflow/temporal";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline.`);
  return value.value as unknown as T;
}

const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

export const textFineComponent = {
  producers: [
    {
      producer: textFineProducers.materializePlainItem,
      handler: ({ inputs }) => ({ outputs: { spec: output(materializePlainTextItem(
        inline<PlainTextItemSpec>(inputs.spec?.value, "PlainTextItemSpec"),
        inline<Text>(inputs.content?.value, "Text"),
      )) }, needs: {} }),
    },
    {
      producer: textFineProducers.bindPoint,
      handler: ({ inputs }) => ({ outputs: { placement: output(bindPointTextPlacement(
        inline<SpatialPoint>(inputs.point?.value, "SpatialPoint"),
        inline<TextPointPlacementPolicy>(inputs.policy?.value, "TextPointPlacementPolicy"),
      )) }, needs: {} }),
    },
    {
      producer: textFineProducers.bindArea,
      handler: ({ inputs }) => ({ outputs: { placement: output(bindAreaTextPlacement(
        inline<SpatialFrame>(inputs.frame?.value, "SpatialFrame"),
        inline<TextFlowPlacementPolicy>(inputs.policy?.value, "TextFlowPlacementPolicy"),
      )) }, needs: {} }),
    },
    {
      producer: textFineProducers.bindPath,
      handler: ({ inputs }) => ({ outputs: { placement: output(bindPathTextPlacement(
        inline<SpatialPath>(inputs.path?.value, "SpatialPath"),
        inline<TextPathPlacementPolicy>(inputs.policy?.value, "TextPathPlacementPolicy"),
        inline<TextPathMotion>(inputs.marginMotion?.value, "TextPathMotion"),
      )) }, needs: {} }),
    },
    {
      producer: textFineProducers.createOccurrence,
      handler: ({ inputs }) => ({ outputs: { occurrence: output(createFineTextOccurrence(
        inline<Timeline>(inputs.timeline?.value, "Timeline"),
        inline<TextPlacement>(inputs.placement?.value, "TextPlacement"),
        inline<TextItemSpec>(inputs.spec?.value, "TextItemSpec"),
        inline<TextStyle>(inputs.style?.value, "TextStyle"),
        inline<TextMotion>(inputs.motion?.value, "TextMotion"),
        inline<TemporalWindow>(inputs.window?.value, "TemporalWindow"),
      )) }, needs: {} }),
    },
    {
      producer: textFineProducers.renderOccurrence,
      handler: ({ inputs }) => ({ outputs: { visual: output(renderFineTextOccurrence(
        inline<Timeline>(inputs.timeline?.value, "Timeline"),
        inline<FineTextOccurrence>(inputs.occurrence?.value, "FineTextOccurrence"),
      )) }, needs: {} }),
    },
    {
      producer: textFineProducers.renderOccurrenceMask,
      handler: ({ inputs }) => ({ outputs: { visual: output(renderFineTextMask(
        inline<Timeline>(inputs.timeline?.value, "Timeline"),
        inline<FineTextOccurrence>(inputs.occurrence?.value, "FineTextOccurrence"),
        inline<CompositableSurfaceRef>(inputs.material?.value, "CompositableSurfaceRef"),
        inline<TextMaskSpec>(inputs.spec?.value, "TextMaskSpec"),
      )) }, needs: {} }),
    },
  ],
} satisfies ProducerPackage & AdmissionPackage;
