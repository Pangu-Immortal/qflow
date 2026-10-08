import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const arguments_ = process.argv.slice(2);
const dryRun = arguments_.includes("--dry-run");
const packageOptions = arguments_.filter((value) => value.startsWith("--package="));
const unknownOption = arguments_.find((value) => value.startsWith("--")
  && value !== "--dry-run" && !value.startsWith("--package="));
if (unknownOption !== undefined) throw new Error(`Unknown option: ${unknownOption}`);

const planPath = resolve(arguments_.find((value) => !value.startsWith("--"))
  ?? "dist/release/release-plan.json");
const plan = JSON.parse(await readFile(planPath, "utf8"));
if (plan.format !== "qflow.release-plan@1" || !Array.isArray(plan.independent)) {
  throw new Error(`${planPath} is not a Qflow release plan`);
}

const byName = new Map(plan.independent.map((item) => [item.name, item]));
const requested = packageOptions.map((value) => value.slice("--package=".length));
const selected = requested.length === 0
  ? plan.independent
  : requested.map((name) => {
    const item = byName.get(name);
    if (item === undefined) throw new Error(`${name} is not an independent package in ${planPath}`);
    return item;
  });
if (new Set(selected.map((item) => item.name)).size !== selected.length) {
  throw new Error("A package was selected more than once");
}

const npmVersion = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
const [npmMajor, npmMinor] = npmVersion.split(".").map(Number);
if (npmMajor < 11 || (npmMajor === 11 && npmMinor < 15)) {
  throw new Error(`npm >= 11.15.0 is required for bulk trusted publishing; found ${npmVersion}`);
}

console.log(`${dryRun ? "Checking" : "Configuring"} GitHub trusted publishing for ${selected.length} packages.`);
for (const [index, item] of selected.entries()) {
  const args = [
    "trust",
    "github",
    item.name,
    "--file",
    "publish-npm.yml",
    "--repository",
    "qflow-ai/qflow",
    "--allow-publish",
    "--yes",
  ];
  if (dryRun) args.push("--dry-run");
  execFileSync("npm", args, { stdio: "inherit" });
  if (!dryRun && index + 1 < selected.length) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
  }
}
