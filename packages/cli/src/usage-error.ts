/** Argument errors point to public usage rather than an internal stack trace. */
export class CliUsageError extends Error {
  readonly code = "CLI_USAGE";
  constructor(message: string, readonly help: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CliUsageError";
  }
}
