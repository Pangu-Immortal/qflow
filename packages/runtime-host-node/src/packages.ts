import { spawn } from "node:child_process";
import { mkdir, open, readFile, realpath, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { externalPackageInstallRoot } from "@qflow/package-loader-node";

export type RegistryPackageSpec = {
  readonly name: string;
  readonly version: string;
  readonly specifier: string;
};

export type HostPackageReport = RegistryPackageSpec & {
  readonly root: string;
  readonly logPath?: string;
  readonly action: "already-installed" | "installed";
};

export type HostPackageProgress = RegistryPackageSpec & {
  readonly phase: "checking" | "installing" | "ready";
  readonly logPath?: string;
};

function exactVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value);
}

/** Registry packages are pinned by version; npm owns their files and dependency graph. */
export function parseRegistryPackageSpec(specifier: string): RegistryPackageSpec {
  const value = specifier.trim();
  const slash = value.startsWith("@") ? value.indexOf("/", 1) : -1;
  const at = value.lastIndexOf("@");
  const split = value.startsWith("@") ? (at > slash ? at : -1) : at;
  const name = split > 0 ? value.slice(0, split) : "";
  const version = split > 0 ? value.slice(split + 1) : "";
  if (name.length === 0 || name.startsWith("@qflow/") || !exactVersion(version)) {
    throw new Error(
      `${specifier} must name one external npm registry package at an exact version, for example hyperframes@0.7.101`,
    );
  }
  if (name.startsWith("@") && (slash < 2 || slash >= name.length - 1)) {
    throw new Error(`${specifier} is not a valid scoped npm package specifier`);
  }
  if (!name.startsWith("@") && !/^[a-z0-9][a-z0-9._-]*$/u.test(name)) {
    throw new Error(`${specifier} is not a valid npm package specifier`);
  }
  return { name, version, specifier: `${name}@${version}` };
}

async function installedVersion(root: string, name: string): Promise<string | undefined> {
  try {
    const manifest = JSON.parse(await readFile(
      join(root, "node_modules", ...name.split("/"), "package.json"),
      "utf8",
    )) as { readonly name?: unknown; readonly version?: unknown };
    return manifest.name === name && typeof manifest.version === "string"
      ? manifest.version
      : undefined;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

export async function inspectHostPackage(
  specifier: string,
  root: string,
): Promise<HostPackageReport | undefined> {
  const required = parseRegistryPackageSpec(specifier);
  const installation = externalPackageInstallRoot(root, required.name, required.version);
  const version = await installedVersion(installation, required.name);
  return version === required.version
    ? { ...required, root: installation, action: "already-installed" }
    : undefined;
}

async function runNpm(root: string, specifiers: readonly string[], logPath: string, env?: Readonly<Record<string, string>>): Promise<void> {
  // npm's prefix and cwd must denote the same physical project (not /tmp vs /private/tmp).
  const cwd = await realpath(root);
  const npmArgs = [
    "install",
    "--prefix", cwd,
    "--save-exact",
    "--no-audit",
    "--no-fund",
    "--omit=dev",
    ...specifiers,
  ];
  const windows = process.platform === "win32";
  const command = windows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const args = windows ? ["/d", "/s", "/c", "npm.cmd", ...npmArgs] : npmArgs;
  const log = await open(logPath, "a");
  await log.write(`\n${new Date().toISOString()} npm ${npmArgs.join(" ")}\n`);
  try {
    await new Promise<void>((done, reject) => {
      const child = spawn(command, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: { ...process.env, ...env },
        stdio: ["ignore", log.fd, log.fd],
      });
      child.on("error", (error) => reject(new Error(`Cannot start npm: ${error.message}. Log: ${logPath}`, { cause: error })));
      child.on("close", (code) => {
        if (code === 0) done();
        else reject(new Error(`npm install failed (exit ${code ?? "signal"}). Log: ${logPath}`));
      });
    });
  } finally {
    await log.close();
  }
}

/**
 * Reuse each exact upstream release in its own npm installation. npm owns its
 * package.json, lockfile and dependencies; Qflow keeps no parallel inventory.
 */
export async function prepareHostPackages(
  specifiers: readonly (string | { readonly specifier: string; readonly env?: Readonly<Record<string, string>> })[],
  options: {
    readonly root: string;
    readonly onProgress?: (event: HostPackageProgress) => void;
  },
): Promise<readonly HostPackageReport[]> {
  const root = resolve(options.root);
  const bySpecifier = new Map<string, RegistryPackageSpec & { readonly env?: Readonly<Record<string, string>> }>();
  for (const specifier of specifiers) {
    const parsed = parseRegistryPackageSpec(typeof specifier === "string" ? specifier : specifier.specifier);
    const env = { ...bySpecifier.get(parsed.specifier)?.env };
    for (const [key, value] of Object.entries(typeof specifier === "string" ? {} : specifier.env ?? {})) {
      if (env[key] !== undefined && env[key] !== value) throw new Error(`Conflicting installation environment ${key} for ${parsed.specifier}`);
      env[key] = value;
    }
    bySpecifier.set(parsed.specifier, { ...parsed, ...(Object.keys(env).length === 0 ? {} : { env }) });
  }
  const required = [...bySpecifier.values()].sort((left, right) => left.specifier.localeCompare(right.specifier));
  const reports: HostPackageReport[] = [];
  for (const { env, ...item } of required) {
    const installation = externalPackageInstallRoot(root, item.name, item.version);
    options.onProgress?.({ ...item, phase: "checking" });
    const missing = await installedVersion(installation, item.name) !== item.version;
    const logPath = join(installation, "install.log");
    if (missing) {
      await mkdir(installation, { recursive: true });
      await writeFile(join(installation, "package.json"), `${JSON.stringify({
        name: "qflow-machine-packages",
        private: true,
        description: "Upstream npm packages used on demand by Qflow",
        dependencies: { [item.name]: item.version },
      }, null, 2)}\n`, "utf8");
      options.onProgress?.({ ...item, phase: "installing", logPath });
      await runNpm(installation, [item.specifier], logPath, env);
    }
    const version = await installedVersion(installation, item.name);
    if (version !== item.version) {
      throw new Error(`npm did not install ${item.specifier} into ${installation}. Log: ${logPath}`);
    }
    options.onProgress?.({ ...item, phase: "ready" });
    reports.push({ ...item, root: installation, ...(missing ? { logPath } : {}), action: missing ? "installed" : "already-installed" });
  }
  return reports;
}
