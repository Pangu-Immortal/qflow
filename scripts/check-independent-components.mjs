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

import { packIndependentPackage, releasedPackageDependencyMap } from "./pack-independent-package.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCli = process.env.npm_execpath;
if (!npmCli?.endsWith("npm-cli.js")) {
  throw new Error("Run npm run check:component-packages.");
}

const root = await mkdtemp(join(tmpdir(), "qflow-component-consumer-"));
const output = join(root, "packages");
const consumer = join(root, "consumer");
const distribution = join(root, "distribution");
let passed = false;
try {
  const comment = await packIndependentPackage("packages/comment-sticker", output);
  const visualTrack = await packIndependentPackage("packages/visual-track", output, { buildPublicTypes: false });
  const depth = await packIndependentPackage("packages/depth-stack", output, { buildPublicTypes: false });
  const emoji = await packIndependentPackage("packages/interview-emoji-reveal", output, { buildPublicTypes: false });
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), `${JSON.stringify({
    name: "independent-component-consumer",
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
    comment,
    visualTrack,
    depth,
    emoji,
  ], {
    cwd: consumer,
    stdio: "inherit",
    env: { ...process.env, npm_config_cache: join(root, "npm-cache") },
  });

  const installed = async (name) => {
    const packageRoot = join(consumer, "node_modules", "@qflow", name);
    return {
      root: packageRoot,
      manifest: JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")),
    };
  };
  const installedComment = await installed("comment-sticker");
  assert.equal(installedComment.manifest.private, undefined);
  assert.equal(installedComment.manifest.exports["."], "./dist/index.js");
  assert.equal(installedComment.manifest.exports["./studio"], "./dist/studio.js");
  assert.equal(installedComment.manifest.qflow.activation, "./dist/activation.js");
  assert.deepEqual(installedComment.manifest.dependencies,
    await releasedPackageDependencyMap("packages/comment-sticker", "dependencies"));
  assert.deepEqual(installedComment.manifest.peerDependencies,
    await releasedPackageDependencyMap("packages/comment-sticker", "peerDependencies"));
  await access(join(installedComment.root, "dist", "studio.js"));
  await access(join(installedComment.root, "preview", "Track.png"));
  await assert.rejects(access(join(installedComment.root, "src", "activation.ts")));

  const installedDepth = await installed("depth-stack");
  assert.equal(installedDepth.manifest.private, undefined);
  assert.equal(installedDepth.manifest.exports["."], "./dist/index.js");
  assert.equal(installedDepth.manifest.exports["./studio"], "./dist/studio.js");
  assert.equal(installedDepth.manifest.qflow.activation, "./dist/activation.js");
  assert.deepEqual(installedDepth.manifest.dependencies,
    await releasedPackageDependencyMap("packages/depth-stack", "dependencies"));
  assert.deepEqual(installedDepth.manifest.peerDependencies,
    await releasedPackageDependencyMap("packages/depth-stack", "peerDependencies"));
  await access(join(installedDepth.root, "dist", "studio.js"));
  await access(join(installedDepth.root, "preview", "DepthStack.png"));
  await assert.rejects(access(join(installedDepth.root, "src", "activation.ts")));

  const installedEmoji = await installed("interview-emoji-reveal");
  assert.equal(installedEmoji.manifest.private, undefined);
  assert.equal(installedEmoji.manifest.exports["."], "./dist/index.js");
  assert.equal(installedEmoji.manifest.qflow.activation, "./dist/activation.js");
  assert.deepEqual(installedEmoji.manifest.dependencies,
    await releasedPackageDependencyMap("packages/interview-emoji-reveal", "dependencies"));
  assert.deepEqual(installedEmoji.manifest.peerDependencies,
    await releasedPackageDependencyMap("packages/interview-emoji-reveal", "peerDependencies"));
  await access(join(installedEmoji.root, "preview", "Track.png"));
  await assert.rejects(access(join(installedEmoji.root, "src", "activation.ts")));

  await mkdir(join(distribution, "packages"), { recursive: true });
  await writeFile(join(distribution, "package.json"), await readFile(join(repositoryRoot, "package.json"), "utf8"));
  const excluded = new Set(["comment-sticker", "comment-sticker-studio", "depth-stack", "interview-emoji-reveal", "visual-track"]);
  for (const entry of await readdir(join(repositoryRoot, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory() || excluded.has(entry.name)) continue;
    await symlink(join(repositoryRoot, "packages", entry.name), join(distribution, "packages", entry.name),
      process.platform === "win32" ? "junction" : "dir");
  }

  installDistributionPackageResolution([distribution]);
  const loaded = await loadNodePackageSelection([
    "@qflow/comment-sticker",
    "@qflow/depth-stack",
    "@qflow/interview-emoji-reveal",
  ], consumer, { fallbackRoots: [distribution] });
  const byName = new Map(loaded.map((item) => [item.specifier, item]));
  const commentPackage = byName.get("@qflow/comment-sticker");
  const depthPackage = byName.get("@qflow/depth-stack");
  const emojiPackage = byName.get("@qflow/interview-emoji-reveal");
  assert.ok(commentPackage);
  assert.ok(depthPackage);
  assert.ok(emojiPackage);
  assert.deepEqual(commentPackage.contribution.modules?.map(({ manifest }) => manifest.name), ["@qflow/comment-sticker"]);
  assert.deepEqual(depthPackage.contribution.modules?.map(({ manifest }) => manifest.name), ["@qflow/depth-stack"]);
  assert.deepEqual(emojiPackage.contribution.modules?.map(({ manifest }) => manifest.name), ["@qflow/interview-emoji-reveal"]);

  const commentStudio = studioContributionFromPackage(
    commentPackage.specifier,
    commentPackage.contribution.facets ?? [],
  );
  assert.equal(commentStudio.tracks.length, 1);
  assert.equal(commentStudio.tracks[0]?.output.type.name, compositionTypes.visualTrack.name);
  assert.equal(commentStudio.tracks[0]?.output.surface, "track");

  const depthStudio = studioContributionFromPackage(
    depthPackage.specifier,
    depthPackage.contribution.facets ?? [],
  );
  assert.equal(depthStudio.tracks.length, 1);
  assert.equal(depthStudio.tracks[0]?.output.type.name, compositionTypes.visualTrack.name);
  assert.equal(depthStudio.tracks[0]?.output.surface, "track");

  const emojiStudio = studioContributionFromPackage(
    emojiPackage.specifier,
    emojiPackage.contribution.facets ?? [],
  );
  assert.equal(emojiStudio.tracks.length, 0);

  const lock = await readFile(join(consumer, "package-lock.json"), "utf8");
  for (const tarball of [comment, depth, visualTrack, emoji]) {
    assert.ok(lock.includes(tarball.split(/[\\/]/u).at(-1)));
  }
  passed = true;
  console.log(`Independent component consumers passed: ${comment}, ${depth}, ${emoji}`);
} finally {
  if (passed) await rm(root, { recursive: true, force: true });
  else console.error(`Independent component consumer retained at ${root}`);
}
