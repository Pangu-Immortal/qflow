import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveNodePackageModule } from "@qflow/loader/node";
import { findProjectRoot, resolveProjectRoot } from "@qflow/project";

import { indexCliCommandModules, runCliApplication } from "./application.js";
import type { CliApplication, CliCommandModule } from "./application.js";
import type { CliDistribution } from "./distribution.js";
import type { CliIo } from "./output.js";
import { runVersionCli, writeVersionHelp } from "./version.js";

type JsonObject = Record<string, unknown>;

type PackageManifest = JsonObject & {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly dependencies?: unknown;
  readonly devDependencies?: unknown;
  readonly optionalDependencies?: unknown;
  readonly qflow?: unknown;
};

export type InstalledCliApplicationOptions = {
  readonly distribution: CliDistribution;
  readonly distributionRoot: string;
  readonly launcher?: string;
  readonly cwd?: string;
};

export type LoadedCliCommandSelection = {
  readonly origin: "distribution" | "project";
  readonly specifier: string;
  readonly package: string;
  readonly version?: string;
  readonly modules: readonly CliCommandModule[];
};

function object(value: unknown, subject: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${subject} must be an object`);
  }
  return value as JsonObject;
}

async function readManifest(root: string, required: boolean): Promise<PackageManifest | undefined> {
  const path = resolve(root, "package.json");
  try {
    return object(JSON.parse(await readFile(path, "utf8")), path) as PackageManifest;
  } catch (error) {
    if (!required && error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function declaredUses(manifest: PackageManifest | undefined, subject: string): readonly string[] {
  if (manifest?.qflow === undefined) return [];
  const qflow = object(manifest.qflow, `${subject}.qflow`);
  if (qflow.cli === undefined) return [];
  const cli = object(qflow.cli, `${subject}.qflow.cli`);
  if (cli.use === undefined) return [];
  if (!Array.isArray(cli.use) || cli.use.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new Error(`${subject}.qflow.cli.use must be an array of npm package export strings`);
  }
  const values = cli.use as string[];
  if (new Set(values).size !== values.length) throw new Error(`${subject}.qflow.cli.use contains a duplicate`);
  return values;
}

function packageName(specifier: string): string {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.includes(":")) {
    throw new Error(`${specifier} must be an npm package export`);
  }
  const parts = specifier.split("/");
  const name = specifier.startsWith("@") ? `${parts[0] ?? ""}/${parts[1] ?? ""}` : parts[0] ?? "";
  if (name.length === 0 || name === "@/" || (specifier.startsWith("@") && parts.length < 2)) {
    throw new Error(`${specifier} must be an npm package export`);
  }
  return name;
}

function dependencyMap(value: unknown): Readonly<Record<string, unknown>> {
  return value === undefined ? {} : object(value, "package dependency map");
}

function requireDirectDependency(manifest: PackageManifest, specifier: string): void {
  const name = packageName(specifier);
  const declared = dependencyMap(manifest.dependencies)[name]
    ?? dependencyMap(manifest.devDependencies)[name]
    ?? dependencyMap(manifest.optionalDependencies)[name];
  if (typeof declared !== "string" || declared.length === 0) {
    throw new Error(`${specifier} is not a direct dependency of this project; install ${name} with the project's package manager first`);
  }
}

function commandModules(value: unknown, subject: string): readonly CliCommandModule[] {
  const exports = object(value, subject);
  if (!Array.isArray(exports.cliCommandModules)) {
    throw new Error(`${subject} must export cliCommandModules`);
  }
  const modules = exports.cliCommandModules as unknown[];
  if (modules.length === 0) throw new Error(`${subject}.cliCommandModules cannot be empty`);
  for (const [index, module] of modules.entries()) {
    const candidate = object(module, `${subject}.cliCommandModules[${index}]`);
    if (candidate.format !== "qflow.cli-command@1" || typeof candidate.id !== "string"
      || !Array.isArray(candidate.commands)
      || candidate.commands.some(command => typeof command !== "string")
      || typeof candidate.writeHelp !== "function"
      || typeof candidate.run !== "function") {
      throw new Error(`${subject}.cliCommandModules[${index}] is not a qflow.cli-command@1 module`);
    }
  }
  return modules as unknown as readonly CliCommandModule[];
}

async function loadSelection(
  specifier: string,
  origin: "distribution" | "project",
  root: string,
  distributionRoot: string,
): Promise<LoadedCliCommandSelection> {
  const located = resolveNodePackageModule(specifier, {
    from: resolve(root, "package.json"),
    workspaceRoots: [root],
    distributionRoots: origin === "distribution" ? [distributionRoot] : [],
  });
  const imported = await import(pathToFileURL(located.module).href);
  const manifest = await readManifest(located.root, true);
  return {
    origin,
    specifier,
    package: located.package,
    ...(typeof manifest?.version === "string" ? { version: manifest.version } : {}),
    modules: commandModules(imported, specifier),
  };
}

async function loadSelections(
  distributionRoot: string,
  projectRoot?: string,
  projectUses?: readonly string[],
): Promise<readonly LoadedCliCommandSelection[]> {
  const distributionManifest = await readManifest(distributionRoot, true);
  const projectManifest = projectRoot === undefined || projectRoot === distributionRoot
    ? undefined
    : await readManifest(projectRoot, false);
  const distributionUses = declaredUses(distributionManifest, resolve(distributionRoot, "package.json"));
  const selectedProjectUses = projectUses
    ?? declaredUses(projectManifest, resolve(projectRoot ?? distributionRoot, "package.json"));
  for (const specifier of selectedProjectUses) {
    if (projectManifest === undefined) throw new Error(`Project has no package.json for CLI selection ${specifier}`);
    requireDirectDependency(projectManifest, specifier);
  }
  const result: LoadedCliCommandSelection[] = [];
  for (const specifier of distributionUses) {
    result.push(await loadSelection(specifier, "distribution", distributionRoot, distributionRoot));
  }
  for (const specifier of selectedProjectUses) {
    if (projectRoot === undefined) throw new Error(`No Qflow project is available for CLI selection ${specifier}`);
    result.push(await loadSelection(specifier, "project", projectRoot, distributionRoot));
  }
  return result;
}

function projectArgument(argv: readonly string[], cwd: string): string | undefined {
  const end = argv.indexOf("--");
  const visible = end < 0 ? argv : argv.slice(0, end);
  for (let index = 0; index < visible.length; index++) {
    const value = visible[index]!;
    if (value === "--project") {
      const selected = visible[index + 1];
      if (selected === undefined || selected.startsWith("--")) throw new Error("--project requires a directory");
      return resolve(cwd, selected);
    }
    if (value.startsWith("--project=")) return resolve(cwd, value.slice("--project=".length));
  }
  return undefined;
}

export function writeCliCompositionHelp(io: Pick<CliIo, "write">): void {
  io.write("qflow cli\nManage this project's explicit CLI command contributions.\n\n"
    + "  qflow cli status [--project <directory>] [--json]\n"
    + "  qflow cli use <installed-package/cli> [--project <directory>]\n"
    + "  qflow cli remove <installed-package/cli> [--project <directory>]\n\n"
    + "use/remove only edit package.json qflow.cli.use. Install and remove packages with the project's package manager.\n");
}

function cliAction(argv: readonly string[]): { action: string; specifier?: string; json: boolean } {
  const positional: string[] = [];
  let json = false;
  for (let index = 1; index < argv.length; index++) {
    const value = argv[index]!;
    if (value === "--project") { index++; continue; }
    if (value.startsWith("--project=")) continue;
    if (value === "--json") { json = true; continue; }
    if (["--debug", "--no-color"].includes(value)) continue;
    if (value === "--color") { index++; continue; }
    if (value === "--help" || value === "-h") return { action: "help", json };
    if (value.startsWith("-")) throw new Error(`Unknown cli option: ${value}`);
    positional.push(value);
  }
  if (positional.length > 2) throw new Error("qflow cli accepts one action and at most one package export");
  return { action: positional[0] ?? "status", ...(positional[1] === undefined ? {} : { specifier: positional[1] }), json };
}

function replaceProjectUses(manifest: PackageManifest, uses: readonly string[]): PackageManifest {
  const existingQflow = manifest.qflow === undefined ? {} : object(manifest.qflow, "package.json.qflow");
  const existingCli = existingQflow.cli === undefined ? {} : object(existingQflow.cli, "package.json.qflow.cli");
  return {
    ...manifest,
    qflow: {
      ...existingQflow,
      cli: { ...existingCli, use: [...uses] },
    },
  };
}

async function runCliComposition(
  argv: readonly string[],
  io: CliIo,
  options: InstalledCliApplicationOptions,
  projectRoot: string | undefined,
): Promise<void> {
  const parsed = cliAction(argv);
  if (parsed.action === "help") { writeCliCompositionHelp(io); return; }
  const projectManifest = projectRoot === undefined ? undefined : await readManifest(projectRoot, false);
  const projectPath = projectRoot === undefined ? undefined : resolve(projectRoot, "package.json");
  const uses = [...declaredUses(projectManifest, projectPath ?? "Project package.json")];
  if (parsed.action === "use") {
    if (projectRoot === undefined) throw new Error("cli use requires a Qflow project; run inside one or pass --project <directory>");
    if (projectManifest === undefined) throw new Error(`No package.json exists at project ${projectRoot}`);
    if (parsed.specifier === undefined) throw new Error("qflow cli use requires one installed package export");
    requireDirectDependency(projectManifest, parsed.specifier);
    const next = uses.includes(parsed.specifier) ? uses : [...uses, parsed.specifier];
    const selections = await loadSelections(options.distributionRoot, projectRoot, next);
    indexCliCommandModules(selections.flatMap(selection => selection.modules));
    if (!uses.includes(parsed.specifier)) {
      await writeFile(resolve(projectRoot, "package.json"), `${JSON.stringify(replaceProjectUses(projectManifest, next), null, 2)}\n`);
    }
    io.write(`CLI command contribution selected: ${parsed.specifier}\nProject: ${projectRoot}\n`);
    return;
  }
  if (parsed.action === "remove") {
    if (projectRoot === undefined) throw new Error("cli remove requires a Qflow project; run inside one or pass --project <directory>");
    if (projectManifest === undefined) throw new Error(`No package.json exists at project ${projectRoot}`);
    if (parsed.specifier === undefined) throw new Error("qflow cli remove requires one package export");
    const next = uses.filter(value => value !== parsed.specifier);
    if (next.length === uses.length) throw new Error(`${parsed.specifier} is not selected by this project`);
    await writeFile(resolve(projectRoot, "package.json"), `${JSON.stringify(replaceProjectUses(projectManifest, next), null, 2)}\n`);
    io.write(`CLI command contribution removed: ${parsed.specifier}\nProject: ${projectRoot}\nThe npm package was not uninstalled.\n`);
    return;
  }
  if (parsed.action !== "status") throw new Error(`Unknown qflow cli action: ${parsed.action}`);
  const selections = await loadSelections(options.distributionRoot, projectRoot);
  indexCliCommandModules(selections.flatMap(selection => selection.modules));
  const report = {
    format: "qflow.cli-composition@1",
    ...(projectRoot === undefined ? {} : { project: projectRoot }),
    contributions: selections.map(selection => ({
      origin: selection.origin,
      specifier: selection.specifier,
      package: selection.package,
      ...(selection.version === undefined ? {} : { version: selection.version }),
      commands: selection.modules.flatMap(module => module.commands),
    })),
  };
  if (parsed.json) { io.write(`${JSON.stringify(report, null, 2)}\n`); return; }
  io.write(`Qflow CLI\nProject: ${projectRoot ?? "none"}\n`);
  for (const contribution of report.contributions) {
    io.write(`\n${contribution.origin === "distribution" ? "Distribution" : "Project"}  ${contribution.specifier}`
      + `${contribution.version === undefined ? "" : ` @ ${contribution.version}`}\n`
      + `  ${contribution.commands.join("\n  ")}\n`);
  }
}

/** Run the root Qflow CLI Host and compose only explicitly selected command contributions. */
export async function runInstalledCliApplication(
  argv: readonly string[],
  io: CliIo,
  options: InstalledCliApplicationOptions,
): Promise<void> {
  const distributionRoot = resolve(options.distributionRoot);
  if (argv[0] === "version" || (argv[0] === "help" && argv[1] === "version")) {
    if (argv[0] === "help") { writeVersionHelp(io); return; }
    await runVersionCli(argv, io, {
      packageRoot: distributionRoot,
      ...(options.launcher === undefined ? {} : { launcher: options.launcher }),
      fetch: globalThis.fetch,
    });
    return;
  }
  if (argv[0] === "cli" || (argv[0] === "help" && argv[1] === "cli")) {
    if (argv[0] === "help") { writeCliCompositionHelp(io); return; }
    const cwd = resolve(options.cwd ?? process.cwd());
    const requestedProject = projectArgument(argv, cwd);
    const projectRoot = requestedProject === undefined
      ? await findProjectRoot({ cwd })
      : await resolveProjectRoot({ projectRoot: requestedProject, cwd });
    await runCliComposition(argv, io, { ...options, distributionRoot }, projectRoot);
    return;
  }
  const cwd = resolve(options.cwd ?? process.cwd());
  const requestedProject = projectArgument(argv, cwd);
  const projectRoot = requestedProject === undefined
    ? await findProjectRoot({ cwd })
    : await resolveProjectRoot({ projectRoot: requestedProject, cwd });
  const selections = await loadSelections(distributionRoot, projectRoot);
  const application: CliApplication = {
    distribution: options.distribution,
    cwd,
    resolveProjectRoot: async (explicit?: string) => {
      if (explicit !== undefined) return await resolveProjectRoot({ projectRoot: explicit, cwd });
      if (projectRoot !== undefined) return projectRoot;
      return await resolveProjectRoot({ cwd });
    },
    commandModules: selections.flatMap(selection => selection.modules),
  };
  await runCliApplication(argv, io, application);
}
