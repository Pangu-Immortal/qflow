import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** Profile `path` is Host-state-relative; it must not write secrets outside that root. */
export function resolveCredentialDirectory(
  hostStateRoot: string,
  path: string | undefined,
  label: string,
): string {
  const root = resolve(hostStateRoot);
  const directory = path === undefined ? join(root, "credentials") : resolve(root, path);
  const relation = relative(root, directory);
  if (relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new Error(`${label} path must stay inside the Host state root`);
  }
  return directory;
}
