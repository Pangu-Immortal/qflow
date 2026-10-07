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

import { packIndependentPackage } from "./pack-independent-package.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCli = process.env.npm_execpath;
if (!npmCli?.endsWith("npm-cli.js")) throw new Error("Run npm run check:qflowhub-package.");

const root = await mkdtemp(join(tmpdir(), "qflow-qflowhub-consumer-"));
const output = join(root, "packages");
const consumer = join(root, "consumer");
const distribution = join(root, "distribution");
let passed = false;
try {
  const mediaOperations = await packIndependentPackage("packages/media-operations", output);
  const mediaLocal = await packIndependentPackage("packages/media-local", output, { buildPublicTypes: false });
  const narrativeSpeechAlignment = await packIndependentPackage(
    "packages/narrative-speech-alignment",
    output,
    { buildPublicTypes: false },
  );
  const whisperx = await packIndependentPackage("packages/whisperx", output, { buildPublicTypes: false });
  const provider = await packIndependentPackage("packages/provider-qflowhub", output, { buildPublicTypes: false });
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), `${JSON.stringify({
    name: "qflowhub-independent-consumer",
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
    mediaOperations,
    mediaLocal,
    narrativeSpeechAlignment,
    whisperx,
    provider,
  ], {
    cwd: consumer,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: join(root, "npm-cache"),
      npm_config_update_notifier: "false",
    },
  });

  const providerRoot = join(consumer, "node_modules", "@qflow", "provider-qflowhub");
  const providerManifest = JSON.parse(await readFile(join(providerRoot, "package.json"), "utf8"));
  assert.equal(providerManifest.private, undefined);
  assert.equal(providerManifest.exports["."], "./dist/index.js");
  assert.equal(providerManifest.qflow.activation, "./dist/activation.js");
  assert.deepEqual(providerManifest.dependencies, {});
  assert.deepEqual(providerManifest.peerDependencies, {
    "@qflow/qflow": "^0.3.0",
    "@qflow/runtime-local": "0.0.0-dev",
    "@qflow/whisperx": "0.0.0-dev",
  });
  await access(join(providerRoot, "dist", "activation.js"));
  await access(join(providerRoot, "LICENSE"));
  await assert.rejects(access(join(providerRoot, "src", "activation.ts")));

  const whisperXRoot = join(consumer, "node_modules", "@qflow", "whisperx");
  const whisperXManifest = JSON.parse(await readFile(join(whisperXRoot, "package.json"), "utf8"));
  assert.equal(whisperXManifest.private, undefined);
  assert.equal(whisperXManifest.exports["."], "./dist/index.js");
  assert.deepEqual(whisperXManifest.dependencies, {
    "@qflow/media-local": "0.0.0-dev",
    "@qflow/narrative-speech-alignment": "0.0.0-dev",
  });
  assert.deepEqual(whisperXManifest.peerDependencies, { "@qflow/qflow": "^0.3.0" });
  await access(join(whisperXRoot, "dist", "activation.js"));

  await mkdir(join(distribution, "packages"), { recursive: true });
  await writeFile(join(distribution, "package.json"), await readFile(join(repositoryRoot, "package.json"), "utf8"));
  for (const entry of await readdir(join(repositoryRoot, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory() || [
      "media-local",
      "media-operations",
      "narrative-speech-alignment",
      "provider-qflowhub",
      "whisperx",
    ].includes(entry.name)) continue;
    await symlink(join(repositoryRoot, "packages", entry.name), join(distribution, "packages", entry.name),
      process.platform === "win32" ? "junction" : "dir");
  }

  installDistributionPackageResolution([distribution]);
  const loaded = await loadNodePackageSelection([
    "@qflow/provider-qflowhub",
    "@qflow/whisperx",
  ], consumer, { fallbackRoots: [distribution] });
  assert.ok(loaded.some((item) => item.specifier === "@qflow/provider-qflowhub"
    && item.contribution.facets?.length === 1));
  assert.ok(loaded.some((item) => item.specifier === "@qflow/whisperx"
    && item.contribution.modules?.[0]?.manifest.name === "@qflow/whisperx"));

  const lock = await readFile(join(consumer, "package-lock.json"), "utf8");
  assert.match(lock, /qflow-provider-qflowhub-0\.0\.0-dev\.tgz/u);
  assert.match(lock, /qflow-whisperx-0\.0\.0-dev\.tgz/u);
  assert.match(lock, /qflow-media-local-0\.0\.0-dev\.tgz/u);
  assert.match(lock, /qflow-media-operations-0\.0\.0-dev\.tgz/u);
  assert.match(lock, /qflow-narrative-speech-alignment-0\.0\.0-dev\.tgz/u);
  passed = true;
  console.log(`Independent QflowHub consumer passed: ${provider}, ${whisperx}`);
} finally {
  if (passed) await rm(root, { recursive: true, force: true });
  else console.error(`Independent QflowHub consumer retained at ${root}`);
}
