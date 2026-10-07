import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  installDistributionPackageResolution,
  loadNodePackageSelection,
} from "../packages/loader/src/node/index.ts";
import { compositionTypes } from "../packages/composition/src/index.ts";
import { admissionPackagesFromFacets } from "../packages/admission/src/index.ts";
import { producerPackagesFromFacets } from "../packages/producer/src/index.ts";
import { studioContributionFromPackage } from "../packages/studio-companion/src/index.ts";

import { packIndependentPackage } from "./pack-independent-package.mjs";
import { distributionEmbeddedPackageDirectories } from "./distribution-ownership.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCli = process.env.npm_execpath;
if (!npmCli?.endsWith("npm-cli.js")) {
  throw new Error("Run npm run check:visual-track-package.");
}

const root = await mkdtemp(join(tmpdir(), "qflow-visual-track-consumer-"));
const output = join(root, "packages");
const consumer = join(root, "consumer");
const distribution = join(root, "distribution");
let passed = false;
try {
  const tarball = await packIndependentPackage("packages/visual-track", output);
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), `${JSON.stringify({
    name: "visual-track-independent-consumer",
    private: true,
    type: "module",
  }, null, 2)}\n`);
  execFileSync(process.execPath, [
    npmCli,
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--legacy-peer-deps",
    tarball,
  ], {
    cwd: consumer,
    stdio: "inherit",
    env: { ...process.env, npm_config_cache: join(root, "npm-cache") },
  });

  const installedRoot = join(consumer, "node_modules", "@qflow", "visual-track");
  const installedManifest = JSON.parse(await readFile(join(installedRoot, "package.json"), "utf8"));
  assert.equal(installedManifest.private, undefined);
  assert.equal(installedManifest.exports["."], "./dist/index.js");
  assert.equal(installedManifest.exports["./studio"], "./dist/studio.js");
  assert.equal(installedManifest.qflow.activation, "./dist/activation.js");
  assert.deepEqual(installedManifest.dependencies, {});
  assert.deepEqual(installedManifest.peerDependencies, {
    "@qflow/qflow": "^0.3.0",
    "@qflow/studio-companion": "0.0.0-dev",
  });
  await access(join(installedRoot, "dist", "activation.js"));
  await access(join(installedRoot, "dist", "studio.js"));
  await access(join(installedRoot, "README.md"));
  await assert.rejects(access(join(installedRoot, "src", "activation.ts")));

  await mkdir(join(distribution, "packages"), { recursive: true });
  const rootManifest = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
  assert.equal(rootManifest.exports["./visual-track"], undefined);
  assert.equal(rootManifest.dependencies["@qflow/visual-track"], "workspace:^");
  assert.equal((await distributionEmbeddedPackageDirectories(repositoryRoot)).has("visual-track"), false);
  await writeFile(join(distribution, "package.json"), `${JSON.stringify(rootManifest, null, 2)}\n`);
  for (const entry of await readdir(join(repositoryRoot, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "visual-track") continue;
    await symlink(join(repositoryRoot, "packages", entry.name), join(distribution, "packages", entry.name),
      process.platform === "win32" ? "junction" : "dir");
  }

  installDistributionPackageResolution([distribution]);
  const loaded = await loadNodePackageSelection(["@qflow/visual-track"], consumer, {
    fallbackRoots: [distribution],
  });
  const visualTrack = loaded.find((item) => item.specifier === "@qflow/visual-track");
  assert.ok(visualTrack);
  assert.deepEqual(visualTrack.contribution.modules?.map(({ manifest }) => [manifest.name, manifest.version]), [
    ["@qflow/visual-track", "1"],
  ]);
  assert.equal(producerPackagesFromFacets(visualTrack.contribution.facets ?? []).length, 1);
  assert.equal(admissionPackagesFromFacets(visualTrack.contribution.facets ?? []).length, 1);
  const studio = studioContributionFromPackage(
    visualTrack.specifier,
    visualTrack.contribution.facets ?? [],
  );
  assert.equal(studio.tracks.length, 1);
  assert.equal(studio.tracks[0]?.output.type.name, compositionTypes.visualTrack.name);
  assert.equal(studio.tracks[0]?.output.surface, "track");

  const lock = await readFile(join(consumer, "package-lock.json"), "utf8");
  assert.match(lock, /qflow-visual-track-0\.0\.0-dev\.tgz/u);
  passed = true;
  console.log(`Independent Visual Track consumer passed: ${tarball}`);
} finally {
  if (passed) await rm(root, { recursive: true, force: true });
  else console.error(`Independent Visual Track consumer retained at ${root}`);
}
