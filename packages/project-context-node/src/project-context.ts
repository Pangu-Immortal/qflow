import { realpath, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function nearestProjectPackageRoot(start: string): Promise<string | undefined> {
  let directory = resolve(start);
  while (true) {
    const candidate = resolve(directory, "package.json");
    try {
      if ((await stat(candidate)).isFile()) return directory;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/**
 * Resolve the project before any Runtime selection is considered.
 *
 * An explicit Workspace is already the boundary. Otherwise the nearest
 * package.json declares the boundary; when none exists, cwd itself is the
 * explicit shell context. Source paths and Runtime state never choose it.
 */
export async function resolveProjectRoot(options: {
  readonly workspaceRoot?: string;
  readonly cwd?: string;
} = {}): Promise<string> {
  const start = resolve(options.workspaceRoot ?? options.cwd ?? process.cwd());
  const selected = options.workspaceRoot !== undefined ? start : await nearestProjectPackageRoot(start) ?? start;
  // Select through the caller's directory first; following a link before discovery
  // could choose a different parent project. Source readers also return real paths.
  return await realpath(selected);
}

/** Project package discovery cannot escape an already resolved project. */
export async function resolvePackageRoot(projectRoot: string): Promise<string> {
  return resolve(projectRoot);
}
