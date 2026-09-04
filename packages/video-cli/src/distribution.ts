import type { CliDistribution } from "@qflow/cli";
import {
  doctorProjectBuildResultRepository,
  openLocalRuntimeHost,
  openProjectBuildResultRepository,
} from "@qflow/runtime-local";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  createVideoCompiler,
} from "./compiler.js";

// The Distribution root is the replaceable Qflow tool checkout, not this
// package's source directory and never the author's project.
const packageRoot = resolve(process.env.QFLOW_DISTRIBUTION_ROOT ?? resolve(import.meta.dirname, "../../.."));
const installedLauncher = process.env.QFLOW_CLI_LAUNCHER;

/** Official video authoring assembly for the generic CLI engine. */
export const videoCliDistribution: CliDistribution = {
  packageRoot,
  bootstrapPackages: [],
  initialRuntimeProfile: {
    format: "qflow.runtime-local@1",
    dataRoot: ".qflow/runtimes/local",
    credentials: {
      os: { use: "@qflow/credential-store-os" },
    },
    endpoints: {
      "qflowhub.default": {
        use: "@qflow/provider-qflowhub",
        config: {
          baseUrl: "https://qflow.ai",
          apiKey: { store: "os", key: "qflowhub.oauth" },
        },
      },
      "media.local": {
        use: "@qflow/provider-media-local",
      },
      "hyperframes.local": {
        use: "@qflow/provider-hyperframes-local",
      },
    },
  },
  createCompiler: createVideoCompiler,
  discoverSourcePackages: async (path, options) => {
    const { discoverVideoSourcePackages } = await import("./package-selection.js");
    return await discoverVideoSourcePackages(path, options);
  },
  openRuntimeHost: async (path, options) => await openLocalRuntimeHost(path, {
    packageRoot: options.packageRoot,
    ...(options.distributionPackageRoot === undefined
      ? {}
      : { distributionPackageRoot: options.distributionPackageRoot }),
    workerLaunch: {
      command: process.execPath,
      // The repository launcher registers TypeScript support before entering the CLI.
      // Tests that import this Distribution directly keep the current Node arguments.
      args: installedLauncher === undefined
        ? [
            ...process.execArgv.filter((item) => !item.startsWith("--test")),
            fileURLToPath(new URL("./cli.ts", import.meta.url)),
          ]
        : [installedLauncher],
    },
  }),
  openProjectResults: async (projectRoot, options) => {
    const opened = await openProjectBuildResultRepository(projectRoot, options);
    return {
      location: opened.location,
      repository: opened.repository,
      close: async () => await opened.close?.(),
    };
  },
  diagnoseProjectResults: async (projectRoot, options) =>
    await doctorProjectBuildResultRepository(projectRoot, options),
};
