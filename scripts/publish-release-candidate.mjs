import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";

const planPath = resolve(process.argv[2] ?? "dist/release/release-plan.json");
const releaseDirectory = dirname(planPath);
const plan = JSON.parse(await readFile(planPath, "utf8"));
if (plan.format !== "qflow.release-plan@1" || !Array.isArray(plan.independent)
  || plan.distribution === null || typeof plan.distribution !== "object") {
  throw new Error(`${planPath} is not a Qflow release plan`);
}

function expectedFilename(name, version) {
  return `${name.replace(/^@/u, "").replaceAll("/", "-")}-${version}.tgz`;
}

function tarballPath(item) {
  if (typeof item.name !== "string" || typeof item.version !== "string" || typeof item.filename !== "string") {
    throw new Error("Release plan contains an incomplete package entry");
  }
  if (!/^\d+\.\d+\.\d+$/u.test(item.version)) {
    throw new Error(`${item.name}@${item.version} is not a stable npm release version`);
  }
  if (item.filename !== expectedFilename(item.name, item.version) || basename(item.filename) !== item.filename) {
    throw new Error(`${item.name}@${item.version} has an invalid tarball filename`);
  }
  const path = resolve(releaseDirectory, item.filename);
  if (path !== releaseDirectory && !path.startsWith(`${releaseDirectory}${sep}`)) {
    throw new Error(`${item.filename} escapes the release directory`);
  }
  return path;
}

function tarballManifest(path) {
  return JSON.parse(execFileSync("tar", ["-xOf", path, "package/package.json"], { encoding: "utf8" }));
}

async function registryVersion(name, version) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    { signal: AbortSignal.timeout(30000) });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`npm lookup for ${name}@${version} failed: HTTP ${response.status}`);
  return await response.json();
}

async function publish(item) {
  const path = tarballPath(item);
  const manifest = tarballManifest(path);
  if (manifest.name !== item.name || manifest.version !== item.version) {
    throw new Error(`${item.filename} contains ${manifest.name}@${manifest.version}, expected ${item.name}@${item.version}`);
  }
  const existing = await registryVersion(item.name, item.version);
  if (existing !== undefined) {
    const bytes = await readFile(path);
    const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    const shasum = createHash("sha1").update(bytes).digest("hex");
    const same = typeof existing.dist?.integrity === "string"
      ? existing.dist.integrity === integrity
      : existing.dist?.shasum === shasum;
    if (!same) throw new Error(`${item.name}@${item.version} already exists with different immutable bytes`);
    console.log(`${item.name}@${item.version} already exists with the same npm integrity; skipping.`);
    return;
  }
  execFileSync("npm", ["publish", path, "--access", "public", "--tag", "latest"], { stdio: "inherit" });
}

const ordered = [...plan.independent, plan.distribution];
const identities = new Set();
for (const item of ordered) {
  const identity = `${item.name}@${item.version}`;
  if (identities.has(identity)) throw new Error(`Release plan repeats ${identity}`);
  identities.add(identity);
  await publish(item);
}
