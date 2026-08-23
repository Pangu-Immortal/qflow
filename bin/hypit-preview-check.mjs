#!/usr/bin/env node
import { register } from "tsx/esm/api";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.env.QFLOW_DISTRIBUTION_ROOT ??= distributionRoot;
process.env.INIT_CWD ??= process.cwd();
register();
const {
  installDistributionPackageResolution,
  installExternalPackageResolution,
} = await import("../packages/package-loader-node/src/distribution-resolution.ts");
installDistributionPackageResolution([distributionRoot]);
const { qflowHostPackageRoot } = await import("../packages/runtime-host-node/src/index.ts");
installExternalPackageResolution([qflowHostPackageRoot()]);
await import("../packages/studio/preview-check.ts");
