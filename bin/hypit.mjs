#!/usr/bin/env node

import { register } from "tsx/esm/api";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
// paths can survive Node's ordinary resolution while package lookup expands them through libuv.
const distributionRoot = realpathSync.native(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
register();
const { installDistributionPackageResolution } =
  await import("#loader/distribution-resolution");
installDistributionPackageResolution([distributionRoot]);
const args = process.argv.slice(2);
const { runInstalledCliApplication, runNodeCli } = await import("#cli");
const { createVideoDistribution } = await import("@qflow/video");
const videoDistribution = createVideoDistribution({
  packageRoot: distributionRoot,
  launcher: fileURLToPath(import.meta.url),
});
await runNodeCli(args, async (argv, io) => await runInstalledCliApplication(argv, io, {
  distribution: videoDistribution,
  distributionRoot,
  launcher: fileURLToPath(import.meta.url),
}));
