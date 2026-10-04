import type { Timeline } from "@qflow/timeline";
import type { ComponentPackage, ProducerHandlerContext } from "@qflow/component-kit";
import { canonicalize } from "@qflow/protocol";
import type { StoredValue } from "@qflow/protocol";
import type { SpatialFrame } from "@qflow/spatial";
import type { TemporalInstant } from "@qflow/temporal";
import type { MediaLayerSet } from "@qflow/visual-track";
import type { Text } from "@qflow/text";

import { renderDepthStack } from "./lower.js";
import { depthStackProducers, depthStackTypes } from "./manifest.js";
import { appendDepthStackCard, assertDepthStackProgram, createDepthStackCardSet, finalizeDepthStack, bindDepthStackCardLabelText } from "./program.js";
import type {
  DepthStackCardLabel,
  DepthStackCardLabelStyle,
  DepthStackCardSet,
  DepthStackCardSpec,
  DepthStackHeader,
  DepthStackProgram,
  DepthStackSpec,
} from "./types.js";

function inline<T>(value: StoredValue | undefined, label: string): T {
  if (value?.kind !== "inline") throw new Error(`${label} must be inline.`);
  return value.value as unknown as T;
}
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

function finalizeInputs(inputs: ProducerHandlerContext["inputs"]) {
  return {
    set: inline<DepthStackCardSet>(inputs.set?.value, "DepthStackCardSet"),
    header: inline<DepthStackHeader>(inputs.header?.value, "DepthStackHeader"),
    frame: inline<SpatialFrame>(inputs.frame?.value, "SpatialFrame"),
    spec: inline<DepthStackSpec>(inputs.spec?.value, "DepthStackSpec"),
    timeline: inline<Timeline>(inputs.timeline?.value, "Timeline"),
  };
}

export const depthStackComponent = {
  producers: [
    {
      producer: depthStackProducers.bindLabelText,
      handler: ({ inputs }) => ({ outputs: { label: output(bindDepthStackCardLabelText(
        inline<DepthStackCardLabelStyle>(inputs.style?.value, "DepthStackCardLabelStyle"),
        inline<Text>(inputs.content?.value, "Text"),
      )) }, needs: {} }),
    },
    {
      producer: depthStackProducers.createCards,
      handler: () => ({ outputs: { set: output(createDepthStackCardSet()) }, needs: {} }),
    },
    {
      producer: depthStackProducers.appendCard,
      handler: ({ inputs }) => ({ outputs: { set: output(appendDepthStackCard(
        inline<DepthStackCardSet>(inputs.set?.value, "DepthStackCardSet"),
        inline<Timeline>(inputs.timeline?.value, "Timeline"),
        inline<MediaLayerSet>(inputs.material?.value, "MediaLayerSet"),
        inline<DepthStackCardLabel>(inputs.label?.value, "DepthStackCardLabel"),
        inline<DepthStackCardSpec>(inputs.spec?.value, "DepthStackCardSpec"),
        inline<TemporalInstant>(inputs.activation?.value, "TemporalInstant"),
      )) }, needs: {} }),
    },
    {
      producer: depthStackProducers.finalize,
      handler: ({ inputs }) => {
        const value = finalizeInputs(inputs);
        return { outputs: { program: output(finalizeDepthStack(
          value.set, value.header, value.frame, value.spec,
          inline<TemporalInstant>(inputs.terminal?.value, "TemporalInstant"), value.timeline,
        )) }, needs: {} };
      },
    },
    {
      producer: depthStackProducers.render,
      handler: ({ inputs }) => ({ outputs: { track: output(renderDepthStack(
        inline<Timeline>(inputs.timeline?.value, "Timeline"),
        inline<DepthStackProgram>(inputs.program?.value, "DepthStackProgram"),
      )) }, needs: {} }),
    },
  ],
  validators: [{
    type: depthStackTypes.program,
    handler: ({ value }) => assertDepthStackProgram(inline<DepthStackProgram>(value, "DepthStackProgram")),
  }],
} satisfies ComponentPackage;
