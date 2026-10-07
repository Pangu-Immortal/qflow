import { canonicalize } from "@qflow/qflow/protocol";
import { plannedNeedInputs } from "@qflow/qflow/producer";
import type { BlobRef, CanonicalValue, StoredValue } from "@qflow/qflow/protocol";
import type { ProducerPackage } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import { imageTransformRequest } from "./execution.js";

import { imageTransformProducers, imageTransformTypes } from "./manifest.js";
import { imageOperationsCapabilities } from "./refs.js";
import { verifyImageTransformProgram } from "./program.js";
import type { ImageTransformProgram } from "./types.js";

function inline(value: StoredValue | undefined, subject: string): ImageTransformProgram {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as unknown as ImageTransformProgram;
}

function blob(value: StoredValue | undefined, subject: string): BlobRef {
  if (value?.kind !== "blob") throw new Error(`${subject} must be a Blob`);
  if (!value.mediaType.startsWith("image/")) throw new Error(`${subject} must be image media`);
  return value;
}

export const imageTransformComponent = {
  validators: [{
    type: imageTransformTypes.program,
    handler: ({ value }) => {
      verifyImageTransformProgram(inline(value, "ImageTransformProgram"));
    },
  }],
  producers: [{
    producer: imageTransformProducers.request,
    handler: ({ inputs }) => {
      const source = blob(inputs.source?.value, "ImageTransform source");
      const program = inline(inputs.program?.value, "ImageTransformProgram");
      verifyImageTransformProgram(program);
      return { outputs: {}, needs: { image: canonicalize(imageTransformRequest(source, program.operations)) } };
    },
  }],
  plannedNeeds: [{
    producer: imageTransformProducers.request,
    port: "image",
    capability: imageOperationsCapabilities.transform,
    plan({ state, step }) {
      const operation = state.plan.steps.find((item) => item.id === step);
      const programRecord = operation?.inputs.program;
      const program = programRecord === undefined
        ? undefined
        : state.records.find((record) => record.id === programRecord)?.value;
      if (program?.kind !== "inline") return undefined;
      return {
        constraints: { program: program.value as CanonicalValue },
        pendingInputs: plannedNeedInputs(state, step, { source: "image" }),
      };
    },
    present(specification) {
      const fields = specification.constraints as Readonly<Record<string, CanonicalValue>>;
      const program = fields.program as Readonly<Record<string, CanonicalValue>> | undefined;
      const operations = Array.isArray(program?.operations) ? program.operations.length : undefined;
      return {
        fields: operations === undefined ? {} : { operations: [operations] },
        references: {
          image: specification.pendingInputs.filter((input) => input.role === "image").length,
        },
      };
    },
  }],
} satisfies ProducerPackage & AdmissionPackage;
