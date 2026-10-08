#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

if (process.argv.length === 3 && ["--version", "-v"].includes(process.argv[2])) {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  console.log(manifest.version);
  process.exit(0);
}

const emitWarning = process.emitWarning;
process.emitWarning = function qflowWarning(warning, ...args) {
  const message = warning instanceof Error ? warning.message : String(warning);
  if (message === "SQLite is an experimental feature and might change at any time") return;
  return emitWarning.call(process, warning, ...args);
};

// Bootstrap and package activation must agree on the physical Distribution root. Windows short
// paths can survive Node's ordinary resolution. Enter the TypeScript host only from the physical
// path so its loader and every later package import share one file identity.
const distributionRoot = realpathSync.native(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const args = process.argv.slice(2);
const canonicalLauncher = resolve(distributionRoot, "bin", "qflow.mjs");
if (fileURLToPath(import.meta.url) !== canonicalLauncher) {
  const child = spawnSync(process.execPath, [...process.execArgv, canonicalLauncher, ...args], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (child.error !== undefined) throw child.error;
  process.exit(child.status ?? 1);
}
const distributionUrl = pathToFileURL(distributionRoot + sep);
const { runQflow } = await import(new URL("bin/run.mjs", distributionUrl).href);
await runQflow(args, {
  distributionRoot,
  launcher: canonicalLauncher,
});
