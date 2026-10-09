import { plannedNeedInputs } from "@qflow/qflow/producer";
import type { BlobRef, CanonicalValue, StoredValue } from "@qflow/qflow/protocol";
import type { ProducerPackage, ProducerHandlerContext } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import { canonicalize } from "@qflow/qflow/protocol";
import type { Canvas, SpatialFrame } from "@qflow/spatial";

import { imageComposeRequest } from "./execution.js";
import { imageComposeProducers, imageComposeTypes, imageOperationsCapabilities } from "./refs.js";
import {
  appendImageComposeLayer,
  assertImageComposeLayerSet,
  assertImageComposeLayerSpec,
  assertImageComposeOptions,
  createImageComposeLayerSet,
} from "./compose-program.js";
import type { ImageComposeLayerSet, ImageComposeLayerSpec, ImageComposeOptions } from "./compose-types.js";

function inline<T>(value: StoredValue | undefined, label: string): T {
  if (value?.kind !== "inline") throw new Error(`${label} must be inline.`);
  return value.value as unknown as T;
}
function blob(value: StoredValue | undefined, label: string): BlobRef {
  if (value?.kind !== "blob") throw new Error(`${label} must be a Blob Artifact.`);
  return value;
}
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

export const imageComposeComponent = {
  producers: [{
    producer: imageComposeProducers.createLayers,
    handler: () => ({ outputs: { layers: output(createImageComposeLayerSet()) }, needs: {} }),
  }, {
    producer: imageComposeProducers.appendLayer,
    handler: ({ inputs }: ProducerHandlerContext) => ({
      outputs: { layers: output(appendImageComposeLayer(
        inline<ImageComposeLayerSet>(inputs.layers?.value, "ImageComposeLayerSet"),
        blob(inputs.source?.value, "Image Compose source"),
        inline<SpatialFrame>(inputs.frame?.value, "SpatialFrame"),
        inline<ImageComposeLayerSpec>(inputs.spec?.value, "ImageComposeLayerSpec"),
      )) },
      needs: {},
    }),
  }, {
    producer: imageComposeProducers.request,
    handler: ({ inputs }: ProducerHandlerContext) => {
      const canvas = inline<Canvas>(inputs.canvas?.value, "Canvas");
      const options = inline<ImageComposeOptions>(inputs.options?.value, "ImageComposeOptions");
      const set = inline<ImageComposeLayerSet>(inputs.layers?.value, "ImageComposeLayerSet");
      return { outputs: {}, needs: { image: imageComposeRequest({
        canvas, background: options.background,
        layers: set.layers.map((layer) => ({
          source: layer.source, frame: layer.frame, fit: layer.spec.fit,
          interpolation: layer.spec.interpolation, opacity: layer.spec.opacity,
        })),
      }) } };
    },
  }],
  validators: [{
    type: imageComposeTypes.options,
    handler: ({ value }) => assertImageComposeOptions(inline<ImageComposeOptions>(value, "ImageComposeOptions")),
  }, {
    type: imageComposeTypes.layerSpec,
    handler: ({ value }) => assertImageComposeLayerSpec(inline<ImageComposeLayerSpec>(value, "ImageComposeLayerSpec")),
  }, {
    type: imageComposeTypes.layerSet,
    handler: ({ value }) => assertImageComposeLayerSet(inline<ImageComposeLayerSet>(value, "ImageComposeLayerSet")),
  }],
  plannedNeeds: [{
    producer: imageComposeProducers.request,
    port: "image",
    capability: imageOperationsCapabilities.compose,
    plan({ state, step }) {
      const operation = state.plan.steps.find((item) => item.id === step);
      if (operation === undefined) return undefined;
      const read = (input: string) => {
        const record = operation.inputs[input];
        const value = record === undefined ? undefined : state.records.find((item) => item.id === record)?.value;
        return value?.kind === "inline" ? value.value : undefined;
      };
      const canvas = read("canvas");
      const options = read("options");
      if (canvas === undefined || options === undefined) return undefined;
      return {
        constraints: { canvas, options },
        pendingInputs: plannedNeedInputs(state, step),
      };
    },
    present(specification) {
      const constraints = specification.constraints as Readonly<Record<string, CanonicalValue>>;
      const canvas = constraints.canvas as Readonly<Record<string, CanonicalValue>> | undefined;
      return {
        fields: typeof canvas?.widthPx === "number" && typeof canvas.heightPx === "number"
          ? { canvas: [`${canvas.widthPx}×${canvas.heightPx}`] }
          : {},
        references: {},
      };
    },
  }],
} satisfies ProducerPackage & AdmissionPackage;
