import { writeSync } from "node:fs";
import { killRenderDescendantsSync } from "./process-tree.js";

// Installed before loading capture: process.exit and uncaught exceptions can
// bypass async finally blocks, including during module import or browser launch.
// Keep cleanup inside the still-live owner, not a history of browser PIDs.
const cleanup = () => {
  try { killRenderDescendantsSync(process.pid); }
  catch (error) {
    writeSync(2, `Render exit cleanup could not be confirmed: ${String(error)}\n`);
  }
};
// `taskkill /T` includes the Windows owner process itself. During an uncaught
// failure the exit hook can therefore stop Node before its usual diagnostic is
// flushed. Preserve that diagnostic synchronously before cleanup begins.
const reportUncaught = (error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  writeSync(2, `${message}\n`);
};
const terminate = () => process.exit(143);
const interrupt = () => process.exit(130);
process.once("exit", cleanup);
process.once("SIGTERM", terminate);
process.once("SIGINT", interrupt);
if (process.platform === "win32") process.on("uncaughtExceptionMonitor", reportUncaught);

/** Call only after capture has closed every resource successfully. */
export function releaseCaptureExitCleanup(): void {
  process.off("exit", cleanup);
  process.off("SIGTERM", terminate);
  process.off("SIGINT", interrupt);
  if (process.platform === "win32") process.off("uncaughtExceptionMonitor", reportUncaught);
}
