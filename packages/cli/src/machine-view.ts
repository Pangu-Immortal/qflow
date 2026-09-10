import type { CliBuildResultView, CliBuildStatusView, CliOutputView } from "./view.js";

type ProgramStateView = {
  readonly id: string;
  readonly state: string;
  readonly action?: string;
  readonly endpoint?: string;
  readonly stateDetail?: string;
  readonly detail?: string;
  readonly pid?: number;
  readonly logPath?: string;
};
type AttentionView = { readonly message: string; readonly action?: string };

export type OperationalMachineView =
  | { readonly format: "qflow.cli-runtime-init@1"; readonly profile: string; readonly project: string; readonly selected: true }
  | { readonly format: "qflow.cli-runtime-selection@1"; readonly selected: boolean; readonly removed?: boolean; readonly profile?: string; readonly project?: string }
  | { readonly format: "qflow.cli-paths@1"; readonly project: string; readonly projectState: string; readonly profile?: string; readonly runtimeData?: string; readonly hostState: string; readonly machinePackages: string; readonly distribution?: string }
  | { readonly format: "qflow.cli-package@1"; readonly action: "install" | "status"; readonly package: string; readonly ready: boolean }
  | { readonly format: "qflow.cli-programs@1"; readonly action: "up" | "down" | "status"; readonly ready: boolean; readonly programs: readonly ProgramStateView[]; readonly omittedPrograms?: number }
  | { readonly format: "qflow.cli-runtime-up@1"; readonly ready: boolean; readonly worker: string; readonly preparedPackages: number; readonly programs: { readonly total: number; readonly ready: number; readonly items: readonly ProgramStateView[] } }
  | { readonly format: "qflow.cli-runtime-logs@1"; readonly lines: readonly string[]; readonly totalLines: number; readonly omittedLines: number; readonly path?: string }
  | { readonly format: "qflow.cli-runtime-down@1"; readonly worker: string }
  | { readonly format: "qflow.cli-runtime-status@1"; readonly ready: boolean; readonly attention: boolean; readonly worker: { readonly state: string; readonly configuration?: string }; readonly builds: Readonly<Record<string, number>>; readonly programs: { readonly total: number; readonly ready: number; readonly unavailable: readonly ProgramStateView[] }; readonly capacity: { readonly active: number } }
  | { readonly format: "qflow.cli-auth-status@1"; readonly endpoint: string; readonly credentials: readonly { readonly endpoint: string; readonly slot: string; readonly label: string; readonly kind: string; readonly configured: boolean; readonly writable: boolean }[]; readonly omittedCredentials?: number }
  | { readonly format: "qflow.cli-auth-change@1"; readonly endpoint: string; readonly slot: string; readonly configured: boolean; readonly changed?: boolean }
  | { readonly format: "qflow.cli-builds@1"; readonly builds: readonly { readonly id: string; readonly createdAt: string; readonly title?: string; readonly outcome: string; readonly run?: string; readonly targetCount: number; readonly targets?: readonly string[]; readonly omittedTargets?: number; readonly outputCount: number }[]; readonly next?: string }
  | { readonly format: "qflow.cli-history@1"; readonly output: string; readonly source?: string; readonly entries: readonly { readonly build: string; readonly title?: string; readonly createdAt: string; readonly outcome: string; readonly output: CliOutputView }[]; readonly next?: string }
  | { readonly format: "qflow.cli-inspect@1"; readonly build: CliBuildResultView }
  | { readonly format: "qflow.cli-result-edit@1"; readonly build: string; readonly title: string | null; readonly note: string | null; readonly highlightedOutputCount: number; readonly highlightedOutputs: readonly string[]; readonly omittedHighlightedOutputs?: number }
  | { readonly format: "qflow.cli-get@1"; readonly build: string; readonly output: string; readonly type: string; readonly kind: "scalar" | "resource" | "composite"; readonly path: string }
  | { readonly format: "qflow.cli-status@1"; readonly build: CliBuildStatusView | null }
  | { readonly format: "qflow.cli-activity@1"; readonly at: number; readonly worker: string; readonly builds: readonly { readonly id: string; readonly work: CliBuildStatusView["work"]; readonly outcome?: string; readonly attention?: AttentionView }[]; readonly omittedBuilds?: number; readonly capacity: readonly import("@qflow/runtime").CapacityReservation[] }
  | { readonly format: "qflow.cli-result-discard@1"; readonly build: string; readonly discarded: boolean }
  | { readonly format: "qflow.cli-result-finish@1"; readonly build: string; readonly found?: false; readonly outcome?: string; readonly attention?: AttentionView }
  | { readonly format: "qflow.cli-cancel@1"; readonly requested: boolean; readonly build: CliBuildStatusView | null }
  | { readonly format: "qflow.cli-build@1"; readonly build: CliBuildStatusView };
