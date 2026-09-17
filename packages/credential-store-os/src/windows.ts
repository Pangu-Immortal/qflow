import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

type WindowsCredentialResult = {
  readonly found?: boolean;
  readonly deleted?: boolean;
  readonly secret?: string;
};

const windowsScript = fileURLToPath(new URL("../runtime/windows-credential.ps1", import.meta.url));

/** The OS adapter owns this one child; Node owns its timeout, bounded output and termination. */
export function windowsCredential(
  operation: "read" | "write" | "delete",
  service: string,
  account: string,
  secret?: string,
): Promise<WindowsCredentialResult> {
  return new Promise((resolve, reject) => {
    const child = execFile("powershell.exe", [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", windowsScript, "-Operation", operation,
    ], {
      shell: false, windowsHide: true, encoding: "utf8", timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error !== null) {
        reject(new Error(`Windows credential ${operation} for ${account} failed`
          + (error.code === undefined ? "" : ` (${error.code})`)
          + (error.killed ? " (child terminated)" : "")
          + (stderr.trim().length === 0 ? "" : `: ${stderr.trim()}`)));
        return;
      }
      try { resolve(JSON.parse(stdout.replace(/^\uFEFF/u, "").trim()) as WindowsCredentialResult); }
      catch { reject(new Error(`Windows credential ${operation} returned an invalid response`)); }
    });
    // A closed input pipe is an operation failure too. Do not leave the child waiting for a request.
    child.stdin!.on("error", () => {
      child.kill();
      reject(new Error(`Windows credential ${operation} request could not be written`));
    });
    child.stdin!.end(JSON.stringify({
      service, account,
      ...(secret === undefined ? {} : { secret: Buffer.from(secret, "utf8").toString("base64") }),
    }));
  });
}
