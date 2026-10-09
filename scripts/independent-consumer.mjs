import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { packIndependentPackage } from "./pack-independent-package.mjs";
import { releaseCandidatePackages } from "./release-candidate.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Install the package's real npm closure alongside the packages under test. */
export async function packConsumerDependencies(directories, output) {
  const entries = await Promise.all(globSync("packages/*/package.json", { cwd: repository }).map(async path => ({
    directory: dirname(path),
    manifest: JSON.parse(await readFile(resolve(repository, path), "utf8")),
  })));
  const byName = new Map(entries.map(entry => [entry.manifest.name, entry]));
  const supplied = new Set(directories.map(directory => `packages/${directory}`));
  const visited = new Set();
  const tarballs = [];
  async function visit(entry) {
    if (visited.has(entry.manifest.name)) return;
    visited.add(entry.manifest.name);
    for (const [name, range] of Object.entries({ ...entry.manifest.dependencies, ...entry.manifest.peerDependencies })) {
      if (name === "@qflow/qflow" || !range.startsWith("workspace:")) continue;
      const dependency = byName.get(name);
      if (dependency === undefined) throw new Error(`Unknown workspace dependency ${name}`);
      await visit(dependency);
    }
    if (!supplied.has(entry.directory)) {
      tarballs.push(await packIndependentPackage(entry.directory, output, { buildPublicTypes: false }));
    }
  }
  for (const entry of entries) if (supplied.has(entry.directory)) await visit(entry);
  return tarballs;
}

/** This fixture supplies only the generic host; the consumer installs domain dependencies. */
export async function consumerHostManifest() {
  const manifest = JSON.parse(await readFile(resolve(repository, "package.json"), "utf8"));
  return { ...manifest, qflow: { ...manifest.qflow, packageSources: [] } };
}

export async function defaultPackageNames() {
  return new Set((await releaseCandidatePackages()).independent.map(item => item.name));
}
