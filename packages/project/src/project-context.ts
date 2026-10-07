import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function isProjectManifest(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const qflow = (value as { readonly qflow?: unknown }).qflow;
  return qflow !== null && typeof qflow === "object" && !Array.isArray(qflow)
    && (qflow as { readonly project?: unknown }).project === true;
}

async function nearestProjectPackageRoot(start: string): Promise<string | undefined> {
  let directory = resolve(start);
  while (true) {
    const candidate = resolve(directory, "package.json");
    try {
      if ((await stat(candidate)).isFile()) {
        const manifest = JSON.parse(await readFile(candidate, "utf8")) as unknown;
        if (isProjectManifest(manifest)) return directory;
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/** Find an explicitly marked Qflow project above cwd without inventing one. */
export async function findProjectRoot(options: { readonly cwd?: string } = {}): Promise<string | undefined> {
  const selected = await nearestProjectPackageRoot(options.cwd ?? process.cwd());
  return selected === undefined ? undefined : await realpath(selected);
}

/**
 * Resolve an explicit project or require one marked in package.json.
 *
 * Source paths, package manifests without `qflow.project: true`, Runtime state
 * and the current directory alone never manufacture a project boundary.
 */
export async function resolveProjectRoot(options: {
  readonly projectRoot?: string;
  readonly cwd?: string;
} = {}): Promise<string> {
  const selected = options.projectRoot === undefined
    ? await findProjectRoot(options.cwd === undefined ? {} : { cwd: options.cwd })
    : resolve(options.cwd ?? process.cwd(), options.projectRoot);
  if (selected === undefined) {
    throw new Error("No Qflow project was found; run inside a package.json with qflow.project set to true, or pass --project <directory>");
  }
  // Select through the caller's directory first; following a link before discovery
  // could choose a different parent project. Source readers also return real paths.
  return await realpath(selected);
}
