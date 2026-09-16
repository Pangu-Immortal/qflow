/**
 * Preloaded into the disposable capture process, which never enters `bin/qflow.mjs`.
 *
 * `module.registerHooks` is process-local, so the resolver the launcher installs does not
 * reach a child that Node starts directly. This registers the same resolution environment
 * in the child, so its view of `@qflow/*` and of the machine packages those modules declare
 * is identical to its parent's.
 *
 * Only relative paths can be used here: no hook exists yet, and a Distribution ships its
 * package sources without any `node_modules` link between them.
 */
import { resolve } from "node:path";

// `bin/qflow.mjs` publishes this for every process it starts; the fallback mirrors
// `packages/video-cli/src/distribution.ts` for callers that import a Distribution directly.
const distributionRoot = resolve(
  process.env.QFLOW_DISTRIBUTION_ROOT ?? resolve(import.meta.dirname, "../../.."),
);

const { installDistributionPackageResolution, installExternalPackageResolution } =
  await import("../../package-loader-node/src/distribution-resolution.js");
installDistributionPackageResolution([distributionRoot]);

const { qflowHostPackageRoot } = await import("../../runtime-host-node/src/index.js");
installExternalPackageResolution([qflowHostPackageRoot()]);
