import {
  createResolvedClosure,
  defineBuild,
  link,
  sealRecord,
} from "@qflow/core";
import type {
  BuildDefinition,
  CommandResult,
  InvokeProducerCommand,
  ModuleManifest,
  ProducerRef,
  TypeRef,
} from "@qflow/protocol";

const moduleRef = { name: "example.core-chain", version: "0.0.0" } as const;
const valueType: TypeRef = { module: moduleRef, name: "Value" };
const advanceProducer: ProducerRef = { module: moduleRef, name: "advance" };

const manifest: ModuleManifest = {
  format: "qflow.module@1",
  name: moduleRef.name,
  version: moduleRef.version,
  dependencies: [],
  types: [{ name: valueType.name }],
  capabilities: [],
  producers: [{
    name: advanceProducer.name,
    inputs: [{ name: "previous", type: valueType }],
    outputs: [{ name: "next", type: valueType }],
    needs: [],
  }],
};

export function createChainDefinition(length: number): BuildDefinition {
  if (!Number.isSafeInteger(length) || length < 1) throw new Error("chain length must be positive");
  const program = link(createResolvedClosure([manifest]), [sealRecord({
    id: "record:0",
    type: valueType,
    value: { kind: "inline", value: 0 },
  })]);
  const finalRecord = `record:${length}`;
  return defineBuild({
    program,
    initialRecords: [],
    plan: {
      format: "qflow.plan@1",
      steps: Array.from({ length }, (_, index) => ({
        id: `step:${index}`,
        producer: advanceProducer,
        inputs: { previous: `record:${index}` },
        outputs: { next: `record:${index + 1}` },
        needs: {},
      })),
      goals: [{ record: finalRecord, type: valueType }],
      outputBindings: [{ output: "result", record: finalRecord, type: valueType }],
    },
    targets: [{ output: "result" }],
  });
}

export function completeChainStep(command: InvokeProducerCommand): CommandResult {
  const index = Number(command.step.slice("step:".length));
  return {
    kind: "producer-completed",
    command: command.id,
    outputs: { next: { kind: "inline", value: index + 1 } },
    needs: {},
  };
}
