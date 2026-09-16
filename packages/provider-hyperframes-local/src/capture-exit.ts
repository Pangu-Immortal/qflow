import { writeSync } from "node:fs";
import { killRenderDescendantsSync } from "./process-tree.js";

// Installed before loading the engine: process.exit and uncaught exceptions can
// bypass async finally blocks, including during engine import/browser launch.
// Keep cleanup inside the still-live owner, not a history of browser PIDs.
const cleanup = () => {
  try { killRenderDescendantsSync(process.pid); }
  catch (error) {
    writeSync(2, `Render exit cleanup could not be confirmed: ${String(error)}\n`);
  }
};
const terminate = () => process.exit(143);
const interrupt = () => process.exit(130);
process.once("exit", cleanup);
process.once("SIGTERM", terminate);
process.once("SIGINT", interrupt);

/** Call only after capture has closed every resource successfully. */
export function releaseCaptureExitCleanup(): void {
  process.off("exit", cleanup);
  process.off("SIGTERM", terminate);
  process.off("SIGINT", interrupt);
}
