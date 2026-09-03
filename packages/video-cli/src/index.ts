import { runCli } from "@qflow/cli";
import type { CliIo } from "@qflow/cli";
import {
  installDistributionPackageResolution,
  installExternalPackageResolution,
} from "@qflow/package-loader-node";
import { qflowHostPackageRoot } from "@qflow/runtime-host-node";
import type { LoadedPackage } from "@qflow/package-loader-node";

import { isCreationCommand, runCreationCli } from "./creation.js";
import { videoCliDistribution } from "./distribution.js";

export {
  createVideoCompiler,
} from "./compiler.js";
export { videoCliDistribution } from "./distribution.js";
export { discoverVideoSourcePackages } from "./package-selection.js";
export { creationCommands, isCreationCommand, runCreationCli, writeCreationHelp } from "./creation.js";
export type { CreationCommand, CreationEnvironment, CreationHost } from "./creation.js";
/** The project's selected Runtime Profile, read the way `qflow` reads it, for tools that run beside the CLI. */
export { findRuntimeProfile } from "@qflow/cli";

export function runVideoCli(
  argv: readonly string[],
  io: CliIo,
  packages: readonly LoadedPackage[] = [],
): Promise<void> {
  installDistributionPackageResolution(videoCliDistribution.packageRoot === undefined
    ? []
    : [videoCliDistribution.packageRoot]);
  installExternalPackageResolution([qflowHostPackageRoot()]);
  if (isCreationCommand(argv[0])) return runCreationCli(argv, io);
  return runCli(argv, io, {
    ...videoCliDistribution,
    bootstrapPackages: packages,
  });
}
