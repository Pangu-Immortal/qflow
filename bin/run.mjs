import { register } from "tsx/esm/api";

/** Enter the TypeScript application after the plain-JavaScript launcher has canonicalized itself. */
export async function runQflow(args, { distributionRoot, launcher }) {
  register();
  const { installDistributionPackageResolution } =
    await import("#loader/distribution-resolution");
  installDistributionPackageResolution([distributionRoot]);
  const { runInstalledCliApplication, runNodeCli } = await import("#cli");
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
