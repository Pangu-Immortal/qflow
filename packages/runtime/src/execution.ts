import type { CommandResult } from "@qflow/protocol";

export type CommandExecutionReceipt = {
  readonly build: string;
  readonly command: string;
  readonly status: "started" | "completed";
  readonly event?: CommandResult;
  /** Current Provider-reported activity; discarded when this call completes. */
  readonly activity?: { readonly endpoint: string; readonly progress: import("./operations.js").OperationProgress };
};

export type CommandExecutionBegin = {
  readonly created: boolean;
  readonly receipt: CommandExecutionReceipt;
};

/** Live handoff for an immediate command between invocation and the accepted Kernel fact. */
export type CommandExecutionStore = {
  begin(build: string, command: string): Promise<CommandExecutionBegin>;
  reportProgress(build: string, command: string, activity: NonNullable<CommandExecutionReceipt["activity"]>): Promise<void>;
  complete(build: string, command: string, event: CommandResult): Promise<CommandExecutionReceipt>;
  list(build: string): Promise<readonly CommandExecutionReceipt[]>;
  removeBuild(build: string): Promise<void>;
};
