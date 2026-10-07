import type { CliBuildResultView, CliBuildStatusView, CliOutputView } from "./view.js";

type AttentionView = { readonly message: string; readonly action?: string };

export type OperationalMachineView =
  | { readonly format: "qflow.cli-logs@1"; readonly build: string; readonly source: "runtime" | "result" | "unavailable"; readonly records: readonly import("@qflow/runtime").ExecutionLogRecord[]; readonly omittedRecords: number }
  | { readonly format: "qflow.cli-auth-status@1"; readonly endpoint: string; readonly credentials: readonly { readonly endpoint: string; readonly slot: string; readonly label: string; readonly kind: string; readonly configured: boolean; readonly writable: boolean; readonly acquisition?: { readonly kind: string; readonly authorizationEndpoint: string } }[]; readonly omittedCredentials?: number }
  | { readonly format: "qflow.cli-auth-change@1"; readonly endpoint: string; readonly slot: string; readonly configured: boolean; readonly changed?: boolean }
  | { readonly format: "qflow.cli-builds@1"; readonly builds: readonly { readonly id: string; readonly createdAt: string; readonly title?: string; readonly outcome: string; readonly run?: string; readonly targetCount: number; readonly targets?: readonly string[]; readonly omittedTargets?: number; readonly outputCount: number }[]; readonly next?: string }
  | { readonly format: "qflow.cli-history@1"; readonly output: string; readonly source?: string; readonly entries: readonly { readonly build: string; readonly title?: string; readonly createdAt: string; readonly outcome: string; readonly output: CliOutputView }[]; readonly next?: string }
  | { readonly format: "qflow.cli-inspect@1"; readonly build: CliBuildResultView }
  | { readonly format: "qflow.cli-result-edit@1"; readonly build: string; readonly title: string | null; readonly note: string | null; readonly highlightedOutputCount: number; readonly highlightedOutputs: readonly string[]; readonly omittedHighlightedOutputs?: number }
  | { readonly format: "qflow.cli-get@1"; readonly build: string; readonly output: string; readonly type: string; readonly kind: "scalar" | "resource" | "composite"; readonly path: string }
  | { readonly format: "qflow.cli-status@1"; readonly build: CliBuildStatusView | null }
  | { readonly format: "qflow.cli-activity@1"; readonly at: number; readonly execution: string; readonly builds: readonly { readonly id: string; readonly work: CliBuildStatusView["work"]; readonly phases: Readonly<Record<string, number>>; readonly attention?: AttentionView }[]; readonly omittedBuilds?: number; readonly capacity?: readonly import("@qflow/runtime").CapacityReservation[] }
  | { readonly format: "qflow.cli-result-discard@1"; readonly build: string; readonly discarded: boolean }
  | { readonly format: "qflow.cli-result-finish@1"; readonly build: string; readonly found?: false; readonly outcome?: string; readonly attention?: AttentionView }
  | { readonly format: "qflow.cli-cancel@1"; readonly requested: boolean; readonly build: CliBuildStatusView | null }
  | { readonly format: "qflow.cli-build@1"; readonly build: CliBuildStatusView };
