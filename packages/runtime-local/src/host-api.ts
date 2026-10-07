import type { BlobAttachment } from "@qflow/qflow/workspace";
import type { BuildResultForward } from "@qflow/qflow/result";
import type { ExecutorRunResult, ExecutorOptions, ProducerRegistry } from "@qflow/qflow/executor";
import type { BuildDefinition, BuildState, CanonicalValue, CapabilityRef, Need, StoredValue } from "@qflow/qflow/protocol";
import type {
  CapacityReservation,
  CredentialAcquisition,
  CredentialRef,
  OperationSnapshot,
  ResourceStore,
} from "@qflow/qflow/runtime";
import type { BuildCatalogDescriptor } from "./catalog.js";
import type { BuildCompletion, BuildExecutionStop, BuildResultRepositoryLocation } from "./execution.js";
import type { RuntimeDoctorDiagnostic } from "@qflow/runtime-local/extension";

export type RuntimeHostActiveBuildSubmission = {
  readonly id: string;
  readonly state: BuildState;
  readonly view: BuildView;
};

export type RuntimeHostFinishedBuildSubmission = {
  readonly id: string;
  readonly state: BuildState;
  readonly completion: BuildCompletion;
};

export type RuntimeHostBuildSubmission = RuntimeHostActiveBuildSubmission | RuntimeHostFinishedBuildSubmission;

export type BuildActivity = "submitting" | "ready" | "running" | "waiting" | "saving-result";

export type BuildOperationView = {
  readonly id?: string;
  readonly receipt?: import("@qflow/qflow/runtime").OperationReceipt;
  readonly wakeAt?: number;
  readonly endpoint: string;
  readonly status: OperationSnapshot["status"];
  readonly progress?: OperationSnapshot["progress"];
  readonly failure?: OperationSnapshot["failure"];
};

/** Stable Host view. Runtime persistence records never cross this boundary. */
export type BuildView = {
  readonly id: string;
  readonly createdAt: number;
  readonly activity: BuildActivity;
  readonly outcome?: BuildCompletion["outcome"];
  readonly issue?: { readonly scope: "result" | "cleanup"; readonly message: string };
  readonly cancellationRequested: boolean;
  readonly stop?: BuildExecutionStop;
  readonly source?: { readonly path: string };
  readonly run?: { readonly path: string };
  readonly targets: readonly string[];
  /** External Needs in the frozen Build Plan and the subset already accepted by Core. */
  readonly requests?: { readonly total: number; readonly completed: number };
  readonly acceptedRecords: number;
  readonly outstandingCommands: number;
  readonly operations: readonly BuildOperationView[];
  /** Activity reported by calls running in the local Worker. */
  readonly commands?: readonly {
    readonly id: string;
    readonly endpoint: string;
    readonly progress: NonNullable<OperationSnapshot["progress"]>;
  }[];
};

export type RuntimeHostCredentialDescription = {
  readonly endpoint: string;
  readonly slot: string;
  readonly label: string;
  readonly kind: "secret" | "json";
  readonly ref: CredentialRef;
  readonly acquisition?: CredentialAcquisition;
  readonly writable: boolean;
};

export type RuntimeHostCredentialStatus = RuntimeHostCredentialDescription & {
  readonly configured: boolean;
};

export type RuntimeHostControl = {
  /** Build evidence while active. Finished evidence is read through its Result Repository. */
  logs?(build: string, lines: number): Promise<import("@qflow/qflow/runtime").ExecutionLogView | undefined>;
  inspect(build: string): Promise<BuildView | undefined>;
  activity(): Promise<{
    readonly builds: readonly BuildView[];
    readonly capacity: readonly CapacityReservation[];
  }>;
  cancel(build: string, reason?: string): Promise<BuildView | undefined>;
  close(): void | Promise<void>;
};

/** One-shot Result write or incomplete-submission cleanup with no execution Providers. */
export type RuntimeHostResultControl = {
  finishResult(build: string): Promise<{
    readonly id: string;
    readonly outcome: BuildCompletion["outcome"];
    readonly issue?: { readonly scope: "result" | "cleanup"; readonly message: string };
  } | undefined>;
  discardSubmission(build: string): Promise<boolean>;
  close(): void | Promise<void>;
};

export type RuntimeHostCredentialControl = {
  /** Endpoint declarations and Store write capability; never reads an existing secret. */
  describeCredentials(endpoint?: string): Promise<readonly RuntimeHostCredentialDescription[]>;
  credentials(endpoint?: string): Promise<readonly RuntimeHostCredentialStatus[]>;
  putCredential(endpoint: string, slot: string, secret: string): Promise<RuntimeHostCredentialStatus>;
  deleteCredential(endpoint: string, slot: string): Promise<{
    readonly deleted: boolean;
    readonly credential: RuntimeHostCredentialStatus;
  }>;
  close(): void | Promise<void>;
};

export type RuntimeHostExecution = RuntimeHostControl & RuntimeHostCredentialControl & RuntimeHostResultControl & {
  build(request: {
    readonly id: string;
    readonly definition: BuildDefinition;
    readonly executionPackages?: readonly string[];
    readonly catalog: BuildCatalogDescriptor;
    readonly attachments?: readonly BlobAttachment[];
    /** Project-owned Result destination, fixed before this Build becomes active. */
    readonly result: {
      readonly repository: BuildResultRepositoryLocation;
      readonly title?: string;
      readonly forwards?: readonly BuildResultForward[];
      readonly resourceReferences?: Readonly<Record<string, import("@qflow/qflow/result").BuildResultFileRef>>;
    };
  }, options?: {
    readonly follow?: boolean;
    readonly pollIntervalMs?: number;
    readonly maxWaitMs?: number;
    readonly signal?: AbortSignal;
  }): Promise<RuntimeHostBuildSubmission>;
};

export type RuntimeHostDoctorResult = {
  readonly dataRoot: string;
  readonly diagnostics: readonly RuntimeDoctorDiagnostic[];
};

/**
 * Disposable graph evaluation through capabilities that their Providers explicitly allow outside
 * a Build. The Host owns Endpoint selection, credentials, invocation and session-local concurrency;
 * callers contribute only deterministic domain Producers, validation and an ephemeral ResourceStore.
 */
export type RuntimeHostTransientExecution = {
  evaluate(input: {
    readonly state: BuildState;
    readonly producers: ProducerRegistry;
    readonly validators: NonNullable<ExecutorOptions["validators"]>;
    readonly resources: ResourceStore;
  }): Promise<ExecutorRunResult>;
  close(): void | Promise<void>;
};

/** The selected Endpoint behind one demanded capability, read from the Profile alone. */
export type RuntimeHostCapabilityProvider = {
  /** Caller-owned identity for this planned request. */
  readonly request: string;
  readonly capability: CapabilityRef;
  readonly status: "resolved" | "unresolved" | "unsupported" | "ambiguous";
  /** Configured Endpoint instance selected for this request, when exactly one is identifiable. */
  readonly endpoint?: string;
  /** Provider package the Runtime Profile selected for that Endpoint. */
  readonly use?: string;
  /** Where that Provider publishes its prices, as the Provider package declares it. */
  readonly pricing?: { readonly kind: "page"; readonly url: string } | { readonly kind: "local" };
  /** Every matching Endpoint instance when the selection is ambiguous. */
  readonly endpoints?: readonly string[];
  /** Provider-owned reasons from Endpoints that offer the capability but reject this request. */
  readonly rejections?: readonly { readonly endpoint: string; readonly message: string }[];
  /** The Endpoint instance the Profile's `bindings` name for this capability, when it names one. */
  readonly binding?: string;
};

export type RuntimeHostCapabilityPricing = RuntimeHostCapabilityProvider & {
  /** Provider-owned current pricing material relevant to this request. */
  readonly pricingDocuments?: readonly {
    readonly source: string;
    readonly data: CanonicalValue;
    readonly summary?: string;
  }[];
  /** A failed pricing-source read. The Provider's static price page remains available. */
  readonly pricingError?: string;
};

export type RuntimeHostProviderQuery = {
  readonly request: string;
  readonly capability: CapabilityRef;
  readonly returns: import("@qflow/qflow/protocol").TypeRef;
  /** Complete support-relevant parameters available before the Build. */
  readonly constraints: import("@qflow/qflow/protocol").CanonicalValue;
  /** Future graph inputs described by the package that owns this request. */
  readonly pendingInputs?: readonly {
    readonly input: string;
    readonly role?: string;
  }[];
};

export type RuntimeWorkerState = {
  readonly state: "running" | "stopped";
  readonly profile: string;
  readonly pid?: number;
  readonly startedAt?: number;
  readonly logPath: string;
};

export type RuntimeController = {
  readonly profile: string;
  readonly dataRoot: string;
  readonly worker: {
    up(options?: { readonly maxWaitMs?: number }): Promise<RuntimeWorkerState>;
    status(): Promise<RuntimeWorkerState>;
    logs(): Promise<{ readonly path: string; readonly text: string }>;
    down(options?: { readonly maxWaitMs?: number }): Promise<RuntimeWorkerState>;
  };
  readonly programs: {
    prepare(options?: { readonly endpoints?: readonly string[]; readonly onProgress?: (event: import("./programs.js").ManagedProgramProgress) => void }): Promise<{ readonly dataRoot: string; readonly programs: readonly import("./programs.js").ManagedProgramReport[] }>;
    up(options: {
      readonly maxWaitMs?: number;
      readonly onProgress?: (event: import("./programs.js").ManagedProgramProgress) => void;
      readonly capabilities?: readonly CapabilityRef[];
      readonly endpoints?: readonly string[];
    }): Promise<{ readonly dataRoot: string; readonly programs: readonly import("./programs.js").ManagedProgramReport[] }>;
    down(options?: { readonly endpoints?: readonly string[] }): Promise<{ readonly dataRoot: string; readonly programs: readonly import("./programs.js").ManagedProgramReport[] }>;
    report(options?: { readonly endpoints?: readonly string[] }): Promise<{ readonly dataRoot: string; readonly programs: readonly import("./programs.js").ManagedProgramReport[] }>;
  };
};

export type RuntimeWorkerLaunch = {
  readonly command: string;
  readonly args: readonly string[];
  readonly workerArgs?: readonly string[];
};

export type LocalRuntimeHost = {
  readonly profile: string;
  executionStatus(): Promise<{ readonly state: "running" | "stopped" }>;
  ensureExecution(options?: { readonly maxWaitMs?: number }): Promise<{ readonly state: "running" | "stopped" }>;
  resolvePaths(): Promise<{
    readonly packageRoot?: string;
    readonly runtimeDataRoot?: string;
  }>;
  controller(options?: {
    readonly packageRoot?: string;
  }): Promise<RuntimeController>;
  createRuntime(options?: { readonly endpoints?: readonly string[] }): Promise<RuntimeHostExecution>;
  openControl(options?: { readonly readOnly?: boolean }): Promise<RuntimeHostControl>;
  /** Open only Result-writing dependencies; never construct execution Providers. */
  openResultControl(): Promise<RuntimeHostResultControl>;
  openCredentials(endpoint: string): Promise<RuntimeHostCredentialControl>;
  /**
   * Read-only, bounded deployment validation for one demanded Build slice.
   * It may inspect local files, credentials and loopback program state, but it
   * never installs, starts or contacts a remote Provider or Artifact Store.
   */
  preflight(options?: {
    readonly capabilities?: readonly CapabilityRef[];
    readonly endpoints?: readonly string[];
  }): Promise<RuntimeHostDoctorResult>;
  /** Active deployment diagnosis. Unlike preflight, adapters may contact their configured services. */
  doctor(options?: {
    readonly capabilities?: readonly CapabilityRef[];
    readonly endpoints?: readonly string[];
  }): Promise<RuntimeHostDoctorResult>;
  /**
   * Which selected Endpoint would serve each capability and where its Provider publishes prices.
   * Reads the Profile and Endpoint declarations only; never resolves a credential or contacts a service.
   */
  providers(requests: readonly RuntimeHostProviderQuery[]): Promise<readonly RuntimeHostCapabilityProvider[]>;
  /** Read current Provider-owned pricing material relevant to these requests. */
  pricing(requests: readonly RuntimeHostProviderQuery[]): Promise<readonly RuntimeHostCapabilityPricing[]>;
  /**
   * Execute one immediate Need through the selected Endpoint and its credentials, outside any Build.
   * The creation-time boundary for observation, transcription and other quick capabilities; it
   * creates no Build, Result or state, and refuses asynchronous capabilities.
   */
  invoke(need: Need, resources: ResourceStore, observation?: RuntimeInvocationObservation): Promise<{ readonly value: StoredValue }>;
  /** Open one disposable authoring execution. It creates no Build, Result or recoverable Operation. */
  openTransientExecution(): Promise<RuntimeHostTransientExecution>;
  runWorker(readyFile: string, owner: string, execution?: { readonly dataRoot: string }): Promise<void>;
};

/** Progress stays with the selected Provider; immediate calls need no synthetic Build. */
export type RuntimeInvocationObservation = {
  readonly reportProgress?: (progress: import("@qflow/qflow/runtime").OperationProgress) => Promise<void>;
  readonly reportDiagnostic?: (diagnostic: import("@qflow/qflow/runtime").ExecutionDiagnostic) => Promise<void>;
};
