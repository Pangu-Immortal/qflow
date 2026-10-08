import { register } from "tsx/esm/api";
import { sep } from "node:path";
import { pathToFileURL } from "node:url";

/** Enter the TypeScript application after the plain-JavaScript launcher has canonicalized itself. */
export async function runQflow(args, { distributionRoot, launcher }) {
  register();
  const distributionUrl = pathToFileURL(distributionRoot + sep);
  const { installDistributionPackageResolution } =
    await import(new URL("packages/loader/src/node/distribution-resolution.ts", distributionUrl).href);
  installDistributionPackageResolution([distributionRoot]);
  const { runInstalledCliApplication, runNodeCli } =
    await import(new URL("packages/cli/src/index.ts", distributionUrl).href);
  const { createVideoDistribution } = await import("@qflow/video");
  const videoDistribution = createVideoDistribution({
    packageRoot: distributionRoot,
    launcher,
  });
  await runNodeCli(args, async (argv, io) => await runInstalledCliApplication(argv, io, {
    distribution: videoDistribution,
    distributionRoot,
    launcher,
  }));
}
