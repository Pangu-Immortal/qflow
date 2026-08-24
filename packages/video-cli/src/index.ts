import {
  materializeArtifact,
  materializeRecord,
  runCli,
} from "@qflow/cli";
import type { CliIo } from "@qflow/cli";
import {
  installDistributionPackageResolution,
  installExternalPackageResolution,
} from "@qflow/package-loader-node";
import { qflowHostPackageRoot } from "@qflow/runtime-host-node";
import type { LoadedPackage } from "@qflow/package-loader-node";

import { videoCliDistribution } from "./distribution.js";

export { materializeArtifact, materializeRecord };
export {
  createVideoCompiler,
} from "./compiler.js";
export { videoCliDistribution } from "./distribution.js";
export { discoverVideoSourcePackages } from "./package-selection.js";

export function runVideoCli(
  argv: readonly string[],
  io: CliIo,
  packages: readonly LoadedPackage[] = [],
): Promise<void> {
  installDistributionPackageResolution(videoCliDistribution.packageRoot === undefined
    ? []
    : [videoCliDistribution.packageRoot]);
  installExternalPackageResolution([qflowHostPackageRoot()]);
  return runCli(argv, io, {
    ...videoCliDistribution,
    bootstrapPackages: packages,
  });
}
