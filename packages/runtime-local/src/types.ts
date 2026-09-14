import type { Awaitable, ComponentPackage } from "@qflow/component-kit";
import type { EndpointPackage } from "@qflow/endpoint-kit";
import type { LoadedComponentPackage } from "@qflow/package-loader-node";
import type { BuildResultRepositoryLocation, BuildResultRepositoryOpened } from "@qflow/build-result-kit";
import type {
  ResourceStore,
  BuildCompletion,
  BuildCatalog,
  BuildStore,
  BuildExecutionStore,
  BuildExecutionSnapshot,
  CredentialStore,
  OperationStore,
} from "@qflow/runtime";
import type {
  RuntimeHostControl,
  RuntimeHostBuildSubmission,
  RuntimeHostCredentialControl,
  RuntimeHostExecution,
  RuntimeHostResultControl,
} from "@qflow/runtime-host-node";

export type CreateLocalRuntimeOptions = {
  /** Already assigned by the local coordinator. Embeddings omit this and start fresh work. */
  readonly executionBuild?: string;
  readonly executionContext?: import("@qflow/protocol").CanonicalValue;
  readonly executionLogs?: import("./log.js").LocalExecutionLogs;
  readonly buildStore: BuildStore;
  /** Host presentation metadata only; never part of Core state. */
  readonly buildCatalog: BuildCatalog;
  readonly operationStore: OperationStore;
  /** Durable receipt boundary: one immediate Command is never invoked twice for one Build. */
  readonly commandExecutionStore: import("@qflow/runtime").CommandExecutionStore;
  readonly executionStore: import("@qflow/runtime").BuildExecutionStore;
  readonly removeActiveBuild: (build: string) => Awaitable<BuildCompletion>;
  /** Atomic submission boundary: external preparation is never a claimable partial Build. */
  readonly submissionStore: import("@qflow/runtime").PendingBuildStore;
  readonly resourceStore: ResourceStore;
  /** Optional Build-local transient byte area used by Provider execution and Result writing. */
  readonly resourceStoreForBuild?: (build: string) => ResourceStore;
  /** Called only after a finished Build Result has accepted every public Output completed so far. */
  readonly clearBuildResources?: (build: string) => Awaitable<void>;
  readonly openBuildResultRepository: (location: BuildResultRepositoryLocation) => Awaitable<BuildResultRepositoryOpened>;
  readonly credentialStore: CredentialStore;
  readonly components?: readonly ComponentPackage[];
  /** Load the complete physical package closure named by a claimed Build. */
  readonly loadComponentPackages?: (specifiers: readonly string[]) => Awaitable<readonly LoadedComponentPackage[]>;
  readonly endpoints?: readonly EndpointPackage[];
  /** Which Endpoint instance serves each capability that several selected Endpoints offer. */
  readonly bindings?: Readonly<Record<string, string>>;
  readonly close?: () => Awaitable<void>;
};

export type CreateLocalRuntimeControlOptions = {
  readonly executionLogs?: import("./log.js").LocalExecutionLogs;
  readonly buildStore: BuildStore;
  readonly commandExecutionStore: import("@qflow/runtime").CommandExecutionStore;
  readonly buildCatalog?: BuildCatalog;
  readonly operationStore: OperationStore;
  readonly executionStore: BuildExecutionStore;
  readonly submissionStore: import("@qflow/runtime").PendingBuildStore;
  /** Optional owner supplied by the Runtime assembly. */
  readonly close?: () => Awaitable<void>;
};

export type CreateLocalResultWriterOptions = {
  readonly executionLogs?: import("./log.js").LocalExecutionLogs;
  readonly buildStore: BuildStore;
  readonly operationStore: OperationStore;
  readonly commandExecutionStore: import("@qflow/runtime").CommandExecutionStore;
  readonly executionStore: BuildExecutionStore;
  readonly removeActiveBuild: (build: string) => Awaitable<BuildCompletion>;
  readonly submissionStore: import("@qflow/runtime").PendingBuildStore;
  readonly resourceStore: ResourceStore;
  readonly resourceStoreForBuild?: (build: string) => ResourceStore;
  readonly clearBuildResources?: (build: string) => Awaitable<void>;
  readonly openBuildResultRepository: (location: BuildResultRepositoryLocation) => Awaitable<BuildResultRepositoryOpened>;
  readonly close?: () => Awaitable<void>;
};

export type CreateLocalCredentialControlOptions = {
  readonly credentialStore: CredentialStore;
  readonly endpoints: readonly EndpointPackage[];
  readonly close?: () => Awaitable<void>;
};

export type LocalBuildRequest = Parameters<RuntimeHostExecution["build"]>[0];
export type LocalBuildOptions = Parameters<RuntimeHostExecution["build"]>[1];
export type LocalBuildSubmission = RuntimeHostBuildSubmission;

export type LocalRuntime = RuntimeHostExecution & {
  /** Advance owned or unstarted work only. Process lifecycle belongs to the Runtime Host. */
  workOnce(options?: { readonly build?: string; readonly hydrated?: () => void }): Promise<BuildExecutionSnapshot | BuildCompletion | undefined>;
};

/** Active execution control that never opens the selected ResourceStore. */
export type LocalRuntimeControl = RuntimeHostControl;

export type LocalResultWriter = RuntimeHostResultControl & {
  /** Incrementally accept public Outputs already completed during execution. */
  sync(execution: BuildExecutionSnapshot, state: import("@qflow/protocol").BuildState): Promise<void>;
  /** Persist the outcome just frozen by the execution Worker, then remove active Runtime state. */
  completeResult(execution: BuildExecutionSnapshot): Promise<BuildExecutionSnapshot | BuildCompletion>;
};

/** Credential control for one or more exact Endpoint declarations; no execution state is opened. */
export type LocalCredentialControl = RuntimeHostCredentialControl;
