import type { CliDistribution } from "@qflow/qflow/cli";
import {
  doctorProjectBuildResultRepository,
  findRuntimeProfile,
  openLocalRuntimeHost,
  openProjectBuildResultRepository,
} from "@qflow/runtime-local";
import type { LocalRuntimeCliDistribution } from "@qflow/runtime-local/cli";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  createVideoCompiler,
  createVideoWorkspace,
} from "./compiler.js";

// The Distribution root is the replaceable Qflow tool checkout, not this
// package's source directory and never the author's project.
export type VideoDistributionOptions = {
  /** Physical root of the installed Qflow video Distribution. */
  readonly packageRoot?: string;
  /** Exact executable the Local Runtime Worker must re-enter. */
  readonly launcher?: string;
};

/** Assemble the official video application once at its executable composition root. */
export function createVideoDistribution(options: VideoDistributionOptions = {}): CliDistribution & LocalRuntimeCliDistribution {
  const packageRoot = resolve(options.packageRoot ?? resolve(import.meta.dirname, "../../.."));
  const launcher = options.launcher ?? fileURLToPath(new URL("../../../bin/qflow.mjs", import.meta.url));
  const openVideoLocalRuntime = async (path: string, runtimeOptions: {
    readonly packageRoot: string;
    readonly distributionPackageRoot?: string;
  }) => await openLocalRuntimeHost(path, {
    packageRoot: runtimeOptions.packageRoot,
    ...(runtimeOptions.distributionPackageRoot === undefined
      ? {}
      : { distributionPackageRoot: runtimeOptions.distributionPackageRoot }),
    workerLaunch: {
      command: process.execPath,
      args: [launcher],
    },
  });
  return {
    packageRoot,
    bootstrapPackages: [],
    initialRuntimeProfile: {
      format: "qflow.runtime-local@1",
      dataRoot: ".qflow/runtimes/local",
      // The starter selects the portable Store, so the Profile it writes is openable and writable on
      // Linux as well: macOS and Windows keep the platform locker, and a Linux host uses an
      // owner-private file. An explicit file backend remains available inside the same local Store.
      credentials: {
        local: { use: "@qflow/credential-store-local" },
      },
      endpoints: {
        "qflowhub.default": {
          use: "@qflow/provider-qflowhub",
          config: {
            baseUrl: "https://qflow.ai",
            apiKey: { store: "local", key: "qflowhub.oauth" },
          },
        },
        "media.local": {
          use: "@qflow/media-local",
        },
        "html.local": {
          use: "@qflow/provider-html-local",
        },
        "image.opencv.local": {
          use: "@qflow/provider-image-opencv-local",
        },
      },
    },
    createWorkspace: createVideoWorkspace,
    resolveProjectRuntime: async (projectRoot) => {
      const selected = await findRuntimeProfile(projectRoot);
      return selected === undefined ? undefined : { profile: selected.profile };
    },
    createCompiler: createVideoCompiler,
    discoverSourcePackages: async (path, options) => {
      const { discoverVideoSourcePackages } = await import("./package-selection.js");
      return await discoverVideoSourcePackages(path, options);
    },
    openLocalRuntimeHost: openVideoLocalRuntime,
    openRuntimeHost: openVideoLocalRuntime,
    openProjectResults: async (projectRoot, options) => {
      const opened = await openProjectBuildResultRepository(projectRoot);
      return {
        location: opened.location,
        repository: opened.repository,
        close() {},
      };
    },
    diagnoseProjectResults: async (projectRoot) => await doctorProjectBuildResultRepository(projectRoot),
  };
}
