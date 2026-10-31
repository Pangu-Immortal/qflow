import { EndpointServiceError } from "@qflow/qflow/endpoint";
import { EndpointHttpError, retryAfterMs } from "@qflow/qflow/endpoint/http";

/** DashScope error bodies carry a request id and a signed asset URL; keep the reason, not the URL. */
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function safeDashScopeReason(value: string): string {
  return value.replace(/https?:\/\/\S+/giu, "[redacted-url]");
}

export class DashScopeServiceError extends EndpointServiceError {}

export class DashScopeHttpError extends EndpointHttpError {
  constructor(status: number, response: { readonly headers: Headers }, bodyText: string,
    request: { readonly method: string; readonly path: string; readonly model?: string }) {
    let body: Record<string, unknown> | undefined;
    try { body = record(JSON.parse(bodyText)); } catch { /* Non-JSON failures still have HTTP evidence. */ }
    const code = text(body?.code) ?? "DASHSCOPE_HTTP_ERROR";
    const reason = text(body?.message)
      ?? (body === undefined ? text(bodyText.slice(0, 2000)) : undefined);
    const requestId = text(body?.request_id) ?? text(response.headers.get("x-request-id"));
    const facts = [
      `DashScope HTTP ${status}`, code, `${request.method} ${request.path}`,
      ...(request.model === undefined ? [] : [`model=${request.model}`]),
      ...(requestId === undefined ? [] : [`request=${requestId}`]),
    ];
    super(code, `${facts.join("; ")}${reason === undefined ? "" : `: ${safeDashScopeReason(reason)}`}`,
      status, retryAfterMs(response.headers));
  }
}

/** A terminal task body; `undefined` when the task did not fail. */
export function dashScopeTaskFailure(output: Record<string, unknown>, id: string): DashScopeServiceError | undefined {
  const status = String(output.task_status);
  if (!["FAILED", "CANCELED", "UNKNOWN"].includes(status)) return undefined;
  const code = text(output.code) ?? "DASHSCOPE_TASK_FAILED";
  const reason = text(output.message) ?? text(output.code);
  return new DashScopeServiceError(code,
    `DashScope task ${id} ${status}; ${code}${reason === undefined ? "" : `: ${safeDashScopeReason(reason)}`}`);
}
