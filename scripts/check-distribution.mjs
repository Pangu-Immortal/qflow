import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Execute the installed package as a user would, without workspace module links or host state.
const npmCli = process.env.npm_execpath;
if (!npmCli?.endsWith("npm-cli.js") || process.argv.length !== 3) {
  throw new Error("Use npm run check:distribution -- /path/to/qflow-qflow-<version>.tgz");
}
const tarball = resolve(process.argv[2]);
const root = await mkdtemp(join(tmpdir(), "qflow-distribution-"));
const project = join(root, "project");
await mkdir(project);
const env = { ...process.env, QFLOW_STATE_HOME: join(root, "state") };
// A caller's checkout resolver must not select sources outside this installation.
delete env.QFLOW_DISTRIBUTION_ROOT;
delete env.QFLOW_CLI_LAUNCHER;
delete env.NODE_PATH;
delete env.NODE_OPTIONS;

function run(command, args, capture = false) {
  console.log(`> ${command} ${args.join(" ")}`);
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: project, env, windowsHide: true,
      stdio: ["ignore", capture ? "pipe" : "inherit", "inherit"] });
    let stdout = "";
    child.stdout?.setEncoding("utf8").on("data", (text) => { stdout += text; });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolveRun(stdout);
      else reject(new Error(`${command} ${args[0]} failed (${signal ?? code})${stdout ? `\n${stdout}` : ""}`));
    });
  });
}
const npm = (...args) => run(process.execPath, [npmCli, ...args]);
const distribution = join(project, "node_modules", "@qflow", "qflow");
const qflow = (args, capture = false) => run(process.execPath, [join(distribution, "bin", "qflow.mjs"), ...args], capture);
const scope = ["--workspace", project, "--runtime", join(project, "qflow.runtime.json")];
let runtimeStarted = false;
let passed = false;
try {
  await writeFile(join(project, "package.json"), JSON.stringify({ name: "distribution-example", private: true, type: "module" }));
  await npm("install", tarball, "--no-audit", "--no-fund");
  await qflow(["--version"]);
  await qflow(["studio", "--help"]);

  const example = join(distribution, "examples", "semantic-composition");
  for (const name of ["chat.svml", "chat.svrun", "chat.svs", "qflow.runtime.json"]) {
    await cp(join(example, name), join(project, name));
  }
  const component = join(project, "packages", "chat-scene");
  await cp(join(example, "packages", "chat-scene"), component, { recursive: true });
  const installed = JSON.parse(await readFile(join(distribution, "package.json"), "utf8"));
  const componentPackage = JSON.parse(await readFile(join(component, "package.json"), "utf8"));
  componentPackage.devDependencies["@qflow/qflow"] = installed.version;
  await writeFile(join(component, "package.json"), JSON.stringify(componentPackage, null, 2));
  const projectPackage = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
  projectPackage.workspaces = ["packages/chat-scene"];
  await writeFile(join(project, "package.json"), JSON.stringify(projectPackage, null, 2));
  await npm("install", "--no-audit", "--no-fund");
  await npm("run", "build", "--workspace", "@example/chat-scene");

  const profilePath = join(project, "qflow.runtime.json");
  const profile = JSON.parse(await readFile(profilePath, "utf8"));
  profile.endpoints["hyperframes.local"].config.browserGpu = "software";
  await writeFile(profilePath, JSON.stringify(profile, null, 2));
  await qflow(["packages", "install", "@fontsource-variable/inter@5.3.0"]);
  await qflow(["check", "chat.svml", "--workspace", project]);
  runtimeStarted = true;
  await qflow(["runtime", "up", ...scope]);
  const result = JSON.parse(await qflow(["build", "chat.svrun", ...scope, "--follow", "--max-wait-ms", "180000", "--json"], true));
  assert.equal(result.build.work.outcome, "complete", JSON.stringify(result));
  const output = join(project, "chat.mp4");
  await qflow(["get", result.build.id, "--workspace", project, "--output", "final.video", "--to", output]);
  const probe = JSON.parse(await run("ffprobe", ["-v", "error", "-show_streams", "-of", "json", output], true));
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  assert.ok(video, "the exported file must contain video");
  assert.equal(video.width, 540);
  assert.equal(video.height, 960);
  assert.equal(video.avg_frame_rate, "30/1");
  assert.equal(Number(video.nb_frames), 240);
  await run("ffmpeg", ["-v", "error", "-xerror", "-i", output, "-f", "null", "-"]);
  passed = true;
  console.log(`Installed @qflow/qflow@${installed.version}: component build, font, render and export passed.`);
} finally {
  if (runtimeStarted) {
    try { await qflow(["runtime", "down", ...scope]); }
    catch (error) { passed = false; console.error(error); process.exitCode = 1; }
  }
  if (passed) await rm(root, { recursive: true, force: true });
  else console.error(`Distribution execution files retained at ${root}`);
}
