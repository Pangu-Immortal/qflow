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
import { admissionPackagesFromFacets } from "../packages/admission/src/index.ts";
import { producerPackagesFromFacets } from "../packages/producer/src/index.ts";
import { studioContributionFromPackage } from "../packages/studio-companion/src/index.ts";

import { packIndependentPackage } from "./pack-independent-package.mjs";
import { distributionEmbeddedPackageDirectories } from "./distribution-ownership.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCli = process.env.npm_execpath;
if (!npmCli?.endsWith("npm-cli.js")) {
  throw new Error("Run npm run check:author-packages.");
}

const names = ["timeline-author", "script", "film", "image-operations", "media-operations", "html-video"];
const root = await mkdtemp(join(tmpdir(), "qflow-author-package-consumer-"));
const output = join(root, "packages");
const consumer = join(root, "consumer");
const distribution = join(root, "distribution");
let passed = false;
try {
  const tarballs = [];
  for (const [index, name] of names.entries()) {
    tarballs.push(await packIndependentPackage(`packages/${name}`, output, { buildPublicTypes: index === 0 }));
  }
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), `${JSON.stringify({
    name: "author-packages-independent-consumer",
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
    ...tarballs,
  ], {
    cwd: consumer,
    stdio: "inherit",
    env: { ...process.env, npm_config_cache: join(root, "npm-cache") },
  });

  for (const name of names) {
    const packageRoot = join(consumer, "node_modules", "@qflow", name);
    const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    assert.equal(manifest.private, undefined);
    assert.equal(manifest.exports["."], "./dist/index.js");
    assert.equal(manifest.qflow.activation, "./dist/activation.js");
    assert.deepEqual(manifest.dependencies, name === "html-video"
      ? { "@qflow/media-operations": "0.0.0-dev" }
      : {});
    assert.deepEqual(manifest.peerDependencies,
      name === "script" || name === "film"
        ? { "@qflow/qflow": "^0.3.0", "@qflow/studio-companion": "0.0.0-dev" }
        : { "@qflow/qflow": "^0.3.0" });
    await access(join(packageRoot, "dist", "activation.js"));
    await access(join(packageRoot, "README.md"));
    await assert.rejects(access(join(packageRoot, "src", "activation.ts")));
    if (name === "script" || name === "film") {
      assert.equal(manifest.exports["./studio"], "./dist/studio.js");
      await access(join(packageRoot, "dist", "studio.js"));
    } else {
      assert.equal(manifest.exports["./studio"], undefined);
    }
  }

  await mkdir(join(distribution, "packages"), { recursive: true });
  const rootManifest = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
  const embedded = await distributionEmbeddedPackageDirectories(repositoryRoot);
  for (const name of names) {
    assert.equal(rootManifest.exports[`./${name}`], undefined);
    assert.equal(rootManifest.dependencies[`@qflow/${name}`], "workspace:^");
    assert.equal(embedded.has(name), false);
  }
  await writeFile(join(distribution, "package.json"), `${JSON.stringify(rootManifest, null, 2)}\n`);
  const excluded = new Set(names);
  for (const entry of await readdir(join(repositoryRoot, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory() || excluded.has(entry.name)) continue;
    await symlink(join(repositoryRoot, "packages", entry.name), join(distribution, "packages", entry.name),
      process.platform === "win32" ? "junction" : "dir");
  }

  installDistributionPackageResolution([distribution]);
  const loaded = await loadNodePackageSelection(
    names.map((name) => `@qflow/${name}`),
    consumer,
    { fallbackRoots: [distribution] },
  );
  const byName = new Map(loaded.map((item) => [item.specifier, item]));
  const timeline = byName.get("@qflow/timeline-author");
  const script = byName.get("@qflow/script");
  const film = byName.get("@qflow/film");
  const imageOperations = byName.get("@qflow/image-operations");
  const mediaOperations = byName.get("@qflow/media-operations");
  const htmlVideo = byName.get("@qflow/html-video");
  assert.ok(timeline);
  assert.ok(script);
  assert.ok(film);
  assert.ok(imageOperations);
  assert.ok(mediaOperations);
  assert.ok(htmlVideo);
  assert.deepEqual(timeline.contribution.modules?.map(({ manifest }) => manifest.name), ["@qflow/timeline-author"]);
  assert.deepEqual(script.contribution.modules?.map(({ manifest }) => manifest.name), ["@qflow/script"]);
  assert.deepEqual(film.contribution.modules?.map(({ manifest }) => manifest.name), ["@qflow/film"]);
  assert.deepEqual(imageOperations.contribution.modules?.map(({ manifest }) => manifest.name),
    ["@qflow/image-operations"]);
  assert.deepEqual(mediaOperations.contribution.modules?.map(({ manifest }) => manifest.name),
    ["@qflow/media-operations"]);
  assert.deepEqual(htmlVideo.contribution.modules?.map(({ manifest }) => manifest.name), ["@qflow/html-video"]);
  const producerPackages = (item) => producerPackagesFromFacets(item.contribution.facets ?? []);
  const admissionPackages = (item) => admissionPackagesFromFacets(item.contribution.facets ?? []);
  assert.equal(producerPackages(timeline).length, 1);
  assert.equal(admissionPackages(timeline).length, 1);
  assert.equal(producerPackages(script).length, 0);
  assert.equal(admissionPackages(script).length, 0);
  assert.equal(producerPackages(film).length, 1);
  assert.equal(admissionPackages(film).length, 1);
  assert.equal(producerPackages(imageOperations).length, 2);
  assert.equal(admissionPackages(imageOperations).length, 2);
  assert.equal(producerPackages(mediaOperations).length, 1);
  assert.equal(admissionPackages(mediaOperations).length, 1);
  assert.equal(producerPackages(htmlVideo).length, 0);
  assert.equal(admissionPackages(htmlVideo).length, 0);

  const scriptStudio = studioContributionFromPackage(script.specifier, script.contribution.facets ?? []);
  const filmStudio = studioContributionFromPackage(film.specifier, film.contribution.facets ?? []);
  assert.equal(scriptStudio.temporalDomains.length, 1);
  assert.equal(scriptStudio.temporalDomains[0]?.id, "@qflow/script#script");
  assert.equal(filmStudio.films.length, 1);
  assert.equal(filmStudio.films[0]?.id, "@qflow/film#film");

  const lock = await readFile(join(consumer, "package-lock.json"), "utf8");
  for (const name of names) assert.match(lock, new RegExp(`qflow-${name}-0\\.0\\.0-dev\\.tgz`, "u"));
  passed = true;
  console.log(`Independent author package consumers passed: ${tarballs.join(", ")}`);
} finally {
  if (passed) await rm(root, { recursive: true, force: true });
  else console.error(`Independent author package consumer retained at ${root}`);
}
