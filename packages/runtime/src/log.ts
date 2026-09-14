/** Provider-authored diagnostic text suitable for users; never credentials or request bodies. */
export type ExecutionDiagnostic = {
  readonly level: "info" | "warning" | "error";
  readonly message: string;
  readonly stream?: "stdout" | "stderr";
};

export type ExecutionLogEvent = { readonly endpoint: string } & (
  | { readonly kind: "started" | "completed" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "phase"; readonly phase: string }
  | ({ readonly kind: "diagnostic" } & ExecutionDiagnostic)
);

export type ExecutionLogRecord = ExecutionLogEvent & {
  readonly format: "qflow.execution-log@1";
  readonly time: number;
  readonly command: string;
};

export type ExecutionLogView = {
  readonly records: readonly ExecutionLogRecord[];
  readonly total: number;
};

/** Read a bounded tail without loading the whole log. Storage and transport remain caller-owned. */
export async function readExecutionLog(chunks: AsyncIterable<Uint8Array>, limit: number): Promise<ExecutionLogView> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Log line count must be a positive integer");
  const decoder = new TextDecoder();
  const records: ExecutionLogRecord[] = [];
  let pending = "";
  let total = 0;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const record = JSON.parse(line) as ExecutionLogRecord;
    if (record.format !== "qflow.execution-log@1") throw new Error("Unsupported execution log format");
    records[total % limit] = record;
    total++;
  };
  for await (const chunk of chunks) {
    pending += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = pending.indexOf("\n")) >= 0) {
      consume(pending.slice(0, newline));
      pending = pending.slice(newline + 1);
    }
  }
  // A running writer may still be appending its last record; only complete lines are visible.
  const offset = total > limit ? total % limit : 0;
  return { records: [...records.slice(offset), ...records.slice(0, offset)], total };
}
