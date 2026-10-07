import { execFileSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { releaseCandidateTarballs } from "./release-candidate.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
if (!npmCli?.endsWith("npm-cli.js")) {
  throw new Error("Run npm run check:release-candidate after npm run pack:release-candidate.");
}

const candidate = await releaseCandidateTarballs();
for (const tarball of [...candidate.independent, candidate.distribution]) await access(tarball);
await access(candidate.plan);
const plan = JSON.parse(await readFile(candidate.plan, "utf8"));
if (plan.format !== "qflow.release-plan@1") throw new Error("Release candidate has no valid release plan");
const expectedTarballs = new Set([...candidate.independent, candidate.distribution]
  .map((path) => path.split(/[\\/]/u).at(-1)));
const actualTarballs = (await readdir(dirname(candidate.plan))).filter((name) => name.endsWith(".tgz"));
const unexpected = actualTarballs.filter((name) => !expectedTarballs.has(name));
const missing = [...expectedTarballs].filter((name) => !actualTarballs.includes(name));
if (unexpected.length > 0 || missing.length > 0) {
  throw new Error(`Release candidate tarballs differ from its dependency closure; unexpected: ${unexpected.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}`);
}

execFileSync(process.execPath, [
  npmCli,
  "run",
  "check:distribution",
  "--",
  candidate.distribution,
  ...candidate.independent,
], { cwd: repositoryRoot, stdio: "inherit" });
