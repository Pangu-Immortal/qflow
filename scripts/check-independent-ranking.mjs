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
import { studioContributionFromPackage } from "../packages/studio-companion/src/index.ts";

import { packIndependentPackage } from "./pack-independent-package.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCli = process.env.npm_execpath;
if (!npmCli?.endsWith("npm-cli.js")) {
  throw new Error("Run npm run check:ranking-package.");
}

const root = await mkdtemp(join(tmpdir(), "qflow-ranking-consumer-"));
const output = join(root, "packages");
const consumer = join(root, "consumer");
const distribution = join(root, "distribution");
let passed = false;
try {
  const ranking = await packIndependentPackage("packages/ranking", output);
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), `${JSON.stringify({
    name: "ranking-independent-consumer",
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
    ranking,
  ], {
    cwd: consumer,
    stdio: "inherit",
    env: { ...process.env, npm_config_cache: join(root, "npm-cache") },
  });

  const installedRoot = join(consumer, "node_modules", "@qflow", "ranking");
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
  await access(join(installedRoot, "preview", "Column.svg"));
  await access(join(installedRoot, "LICENSE"));
  await assert.rejects(access(join(installedRoot, "src", "activation.ts")));

  await mkdir(join(distribution, "packages"), { recursive: true });
  await writeFile(join(distribution, "package.json"), await readFile(
    join(repositoryRoot, "package.json"), "utf8",
  ));
  for (const entry of await readdir(join(repositoryRoot, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "ranking" || entry.name === "ranking-studio") continue;
    await symlink(join(repositoryRoot, "packages", entry.name), join(distribution, "packages", entry.name),
      process.platform === "win32" ? "junction" : "dir");
  }

  installDistributionPackageResolution([distribution]);
  const loaded = await loadNodePackageSelection(["@qflow/ranking"], consumer, {
    fallbackRoots: [distribution],
  });
  const installedRanking = loaded.find((item) => item.specifier === "@qflow/ranking");
  assert.ok(installedRanking);
  assert.deepEqual(installedRanking.contribution.modules?.map((item) => [
    item.manifest.name,
    item.manifest.version,
  ]), [["@qflow/ranking", "1"]]);
  const studio = studioContributionFromPackage(
    installedRanking.specifier,
    installedRanking.contribution.facets ?? [],
  );
  assert.equal(studio.tracks.length, 6);
  for (const surface of ["column", "tier", "top-three"]) {
    const tracks = studio.tracks.filter((track) => track.output.surface === surface);
    assert.equal(tracks.length, 2);
    assert.ok(tracks.some((track) => track.output.type.name === compositionTypes.visualTrack.name));
    assert.ok(tracks.some((track) => track.output.type.name === compositionTypes.audioTrack.name));
  }

  const lock = await readFile(join(consumer, "package-lock.json"), "utf8");
  assert.match(lock, /qflow-ranking-0\.0\.0-dev\.tgz/u);
  passed = true;
  console.log(`Independent Ranking consumer passed: ${ranking}`);
} finally {
  if (passed) await rm(root, { recursive: true, force: true });
  else console.error(`Independent Ranking consumer retained at ${root}`);
}
