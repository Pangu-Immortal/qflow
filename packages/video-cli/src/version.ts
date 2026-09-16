import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CliIo } from "@qflow/cli";
import { requestDeadline } from "@qflow/runtime-kit";

type VersionEnvironment = {
  readonly packageRoot: string;
  readonly launcher?: string;
  readonly fetch: typeof globalThis.fetch;
  readonly timeoutMs?: number;
};

export function writeVersionHelp(io: CliIo): void {
  io.write("Usage: qflow version [--check] [--registry <url>] [--json]\n\n"
    + "Show the executing Distribution and launcher without opening a project or Runtime.\n"
    + "--check queries npm latest (registry.npmjs.org by default); --registry selects a mirror.\n"
    + "No packages or Skills are updated. qflow --version remains a local version-only query.\n");
}

/** Installation discovery belongs to the executable, independent of video execution and Skill installers. */
export async function runVersionCli(argv: readonly string[], io: CliIo, environment: VersionEnvironment = {
  packageRoot: resolve(import.meta.dirname, "../../.."),
  launcher: resolve(import.meta.dirname, "../../../bin/qflow.mjs"),
  fetch: globalThis.fetch,
}): Promise<void> {
  let check = false;
  let json = false;
  let registry = "https://registry.npmjs.org/";
  let selectedRegistry = false;
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") check = true;
    else if (arg === "--json") json = true;
    else if (arg === "--registry") {
      selectedRegistry = true;
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) throw new Error("--registry requires a URL");
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error("--registry requires an HTTP(S) registry URL without credentials, query or fragment");
      }
      registry = `${url.href.replace(/\/+$/u, "")}/`;
    } else if (arg === "--help") { writeVersionHelp(io); return; }
    else if (arg !== "--no-color" && arg !== "--debug") throw new Error(`Unknown version option: ${arg}`);
  }
  if (selectedRegistry && !check) throw new Error("--registry selects the source for --check; add --check to query it");
  const manifest = JSON.parse(await readFile(resolve(environment.packageRoot, "package.json"), "utf8")) as {
    name: string; version: string; repository?: { url?: string };
  };
  const repository = manifest.repository?.url?.replace(/^git\+/u, "").replace(/\.git$/u, "");
  const releases = repository === undefined ? undefined : `${repository}/releases`;
  let latest: { registry: string; version?: string; matchesInstalled?: boolean; error?: string } | undefined;
  if (check) {
    latest = { registry };
    const deadline = requestDeadline(environment.timeoutMs ?? 10_000,
      () => new Error("Registry version query timed out; latest version is unknown"));
    try {
      const response = await deadline.wait(environment.fetch(new URL(`${encodeURIComponent(manifest.name)}/latest`, registry), {
        signal: deadline.signal, headers: { accept: "application/json" },
      }));
      if (!response.ok) throw new Error(`Registry returned HTTP ${response.status}; latest version is unknown`);
      const body = await deadline.wait(response.json()) as { name?: unknown; version?: unknown };
      if (body.name !== manifest.name || typeof body.version !== "string" || body.version.length === 0) {
        throw new Error("Registry returned no matching package version; latest version is unknown");
      }
      latest.version = body.version;
      latest.matchesInstalled = body.version === manifest.version;
    } catch (error) {
      latest.error = error instanceof Error ? error.message : String(error);
      io.setExitCode?.(1);
    } finally { deadline.finish(); }
  }
  const report = {
    format: "qflow.cli-version@1", package: manifest.name, version: manifest.version,
    distribution: resolve(environment.packageRoot),
    ...(environment.launcher === undefined ? {} : { launcher: resolve(environment.launcher) }),
    ...(releases === undefined ? {} : { releases }),
    ...(latest === undefined ? {} : { latest }),
  };
  if (json) { io.write(`${JSON.stringify(report, null, 2)}\n`); return; }
  io.write(`${manifest.name} ${manifest.version}\nDistribution: ${report.distribution}\n`
    + (report.launcher === undefined ? "" : `Launcher: ${report.launcher}\n`));
  if (latest !== undefined) {
    io.write(`npm latest: ${latest.version === undefined ? "unknown" : `${latest.version} (${latest.matchesInstalled ? "matches installed" : "differs from installed"})`}\nRegistry: ${registry}\n`);
    if (latest.error !== undefined) io.write(`${latest.error}\n`);
    if (releases !== undefined) io.write(`Release notes: ${releases}\n`);
    io.write("Update through this installation's package manager or checkout; preserve the project's chosen version.\n"
      + "Skill updates belong to its installer and are separate from this executable.\n");
  }
}
