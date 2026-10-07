import type {
  BuildState,
  BuildCommand,
  TypeRef,
  CapabilityRef,
} from "@qflow/protocol";
import type {
  ProducerHandler,
} from "@qflow/producer";
import type { EndpointRegistrationOptions, EndpointScheduling, ImmediateEndpointHandler, AsyncEndpoint } from "@qflow/endpoint";

export type {
  ProducerHandler,
  ProducerHandlerContext,
  ProducerHandlerResult,
  ProducerRegistrar,
} from "@qflow/producer";

export type ExecutorExecutionOutcome = {
  readonly command: string;
  readonly kind: BuildCommand["kind"];
  readonly status: "completed" | "pending" | "error";
  readonly operation?: string;
  readonly wakeAt?: number;
  readonly message?: string;
};

export type BlockedCommand = {
  readonly command: string;
  readonly reason:
    | "missing-producer"
    | "missing-endpoint"
    | "unsupported-endpoint-request"
    | "ambiguous-endpoint"
    | "missing-operation-store";
  readonly subject: string;
};

export type ExecutorRunResult = {
  readonly status: "complete" | "paused" | "failed";
  readonly state: BuildState;
  readonly outcomes: readonly ExecutorExecutionOutcome[];
  readonly blocked: readonly BlockedCommand[];
};

export type ProducerRegistration = {
  readonly handler: ProducerHandler;
  readonly scheduling?: EndpointScheduling;
};

type EndpointRegistrationBase = {
  readonly id: string;
  readonly capability: CapabilityRef;
  readonly returns: TypeRef;
} & EndpointRegistrationOptions;

export type EndpointRegistration = EndpointRegistrationBase & (
  | { readonly kind: "immediate"; readonly handler: ImmediateEndpointHandler }
  | { readonly kind: "asynchronous"; readonly endpoint: AsyncEndpoint }
);

export type EndpointResolution =
  | { readonly status: "resolved"; readonly registration: EndpointRegistration }
  | { readonly status: "missing"; readonly endpointId?: string }
  | {
    readonly status: "unsupported";
    readonly rejections: readonly { readonly endpointId: string; readonly reason: string }[];
  }
  | { readonly status: "ambiguous"; readonly endpointIds: readonly string[] };
