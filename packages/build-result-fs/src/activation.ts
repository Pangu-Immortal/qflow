import { resolve } from "node:path";

import { FileBuildResultRepository } from "@qflow/build-result";
import { buildResultConfigExact, buildResultConfigObject, buildResultConfigString, createBuildResultRepositoryHostFacet } from "@qflow/build-result-kit";

const filesystemBuildResultRepository = createBuildResultRepositoryHostFacet({
  use: "@qflow/build-result-fs",
  validate(context) {
    const config = buildResultConfigObject(context.config, "filesystem Build Result Repository");
    buildResultConfigExact(config, ["path"], "filesystem Build Result Repository");
    if (buildResultConfigString(config.path, "Build Result path") === undefined) {
      throw new Error("Build Result path is required");
    }
  },
  open(context) {
    const config = buildResultConfigObject(context.config, "filesystem Build Result Repository");
    const path = buildResultConfigString(config.path, "Build Result path");
    if (path === undefined) throw new Error("Build Result path is required");
    return {
      repository: new FileBuildResultRepository(resolve(context.root, path)),
    };
  },
});

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [filesystemBuildResultRepository],
};

export default qflowPackage;
