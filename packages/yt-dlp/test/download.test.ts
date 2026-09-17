import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";

import { resolveNodePackageResource } from "@qflow/package-loader-node";

import { downloadVideo, isVideoUrl } from "../src/download.js";

test("only http and https links are fetched; Windows paths stay files", () => {
  assert.equal(isVideoUrl("https://youtu.be/example"), true);
  assert.equal(isVideoUrl("http://example.test/clip.mp4"), true);
  assert.equal(isVideoUrl("C:\\clip.mp4"), false);
  assert.equal(isVideoUrl("c:\\clip.mp4"), false);
  assert.equal(isVideoUrl("file:///tmp/clip.mp4"), false);
  assert.equal(isVideoUrl("/tmp/clip.mp4"), false);
});

test("fetch with a missing environment reports preparation without installing or fetching", async (t) => {
  let calls = 0;
  t.mock.method(childProcess, "spawnSync", (command: string, args: string[]) => {
    calls++;
    assert.notEqual(command, "uv");
    assert.deepEqual(args, ["--ignore-config", "--version"]);
    return { status: null, error: new Error("ENOENT"), stdout: "", stderr: "" };
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(downloadVideo("https://example.invalid/video", join(tmpdir(), "never-fetched.mp4")), /media prepare-fetch/u);
  assert.equal(calls, 1);
});

test("download resolves its declared service from an installed package outside the checkout", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "qflow-installed-yt-dlp-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const modules = join(directory, "node_modules", "@qflow");
  const installed = join(modules, "yt-dlp");
  const service = join(modules, "yt-dlp-service-runtime");
  const loader = join(modules, "package-loader-node");
  await mkdir(join(installed, "src"), { recursive: true });
  await mkdir(service, { recursive: true });
  await mkdir(loader, { recursive: true });
  await cp(new URL("../package.json", import.meta.url), join(installed, "package.json"));
  await cp(new URL("../src/download.ts", import.meta.url), join(installed, "src", "download.ts"));
  await cp(new URL("../src/environment.ts", import.meta.url), join(installed, "src", "environment.ts"));
  const host = join(modules, "runtime-host-node");
  await mkdir(host, { recursive: true });
  await writeFile(join(host, "package.json"), JSON.stringify({ name: "@qflow/runtime-host-node", type: "module", exports: "./index.mjs" }));
  await writeFile(join(host, "index.mjs"), `export { qflowHostStateRoot, pythonEnvironmentCommand } from ${JSON.stringify(import.meta.resolve("@qflow/runtime-host-node"))};`);
  const sourceService = dirname(resolveNodePackageResource("@qflow/yt-dlp-service-runtime", "pyproject.toml", { from: import.meta.url }));
  for (const name of ["package.json", "pyproject.toml", "uv.lock"]) await cp(join(sourceService, name), join(service, name));
  // Forward only the real locator implementation; no workspace links or services/ ancestor exists.
  await writeFile(join(loader, "package.json"), JSON.stringify({ name: "@qflow/package-loader-node", type: "module", exports: "./index.mjs" }));
  await writeFile(join(loader, "index.mjs"), `export { resolveNodePackageResource } from ${JSON.stringify(import.meta.resolve("@qflow/package-loader-node"))};`);
  let calls = 0;
  t.mock.method(childProcess, "spawnSync", (command: string, args: string[]) => {
    calls++;
    assert.notEqual(command, "uv", "fetch must not run the environment installer");
    if (args.includes("--version")) return { status: 0, stderr: "", stdout: "2026.08.19\n" };
    if (command === "ffmpeg") return { status: 0, stderr: "", stdout: "ffmpeg" };
    assert.match(command, /yt-dlp/u);
    assert.ok(args.includes("--no-remote-components"));
    assert.ok(args.includes("--ignore-config"));
    assert.equal(args.at(-1), "https://example.test/video");
    const output = args[args.indexOf("--output") + 1]!.replace("%(ext)s", "mp4");
    writeFileSync(output, "downloaded bytes");
    return { status: 0, stderr: "", stdout: "" };
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const module = await import(pathToFileURL(join(installed, "src", "download.ts")).href);
  const target = join(directory, "reference.mp4");
  await module.downloadVideo("https://example.test/video", target);
  assert.equal(await readFile(target, "utf8"), "downloaded bytes");
  assert.equal(calls, 3);
});

test("the pinned yt-dlp project is a Distribution package asset", () => {
  const project = dirname(resolveNodePackageResource(
    "@qflow/yt-dlp-service-runtime",
    "pyproject.toml",
    { from: import.meta.url },
  ));
  assert.ok(existsSync(join(project, "pyproject.toml")));
  assert.ok(existsSync(join(project, "uv.lock")));
});
