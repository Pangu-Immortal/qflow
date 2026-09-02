import { runCli } from "@qflow/cli";
import type { CliIo } from "@qflow/cli";
import {
  installDistributionPackageResolution,
  installExternalPackageResolution,
} from "@qflow/package-loader-node";
import { qflowHostPackageRoot } from "@qflow/runtime-host-node";
import type { LoadedPackage } from "@qflow/package-loader-node";

import { videoCliDistribution } from "./distribution.js";
import { runVideoImageCli } from "./image-command.js";
import { writeVideoImageHelp } from "./image-command.js";

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
  if ((argv[0] === "image" && argv.includes("--help"))
    || (argv[0] === "help" && argv[1] === "image")) {
    writeVideoImageHelp(io);
    return Promise.resolve();
  }
  if (argv[0] === "image") {
    return runVideoImageCli(argv, io, videoCliDistribution.packageRoot);
  }
  return runCli(argv, io, {
    ...videoCliDistribution,
    bootstrapPackages: packages,
  });
}
