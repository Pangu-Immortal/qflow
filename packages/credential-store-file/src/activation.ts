import { join, resolve } from "node:path";
import {
  createRuntimeCredentialStoreAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
  runtimeConfigString,
} from "@qflow/runtime-kit";
import { FileCredentialStore } from "./store.js";

const fileCredentialStoreAdapter = createRuntimeCredentialStoreAdapterFacet({
  use: "@qflow/credential-store-file",
  validate(context) {
    const config = runtimeConfigObject(context.config, "file CredentialStore");
    runtimeConfigExact(config, ["path"], "file CredentialStore");
    runtimeConfigString(config.path, "file credential path");
  },
  open(context) {
    const config = runtimeConfigObject(context.config, "file CredentialStore");
    const path = runtimeConfigString(config.path, "file credential path");
    return { value: new FileCredentialStore(
      path === undefined ? join(context.hostStateRoot, "credentials") : resolve(context.hostStateRoot, path),
    ) };
  },
});

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [fileCredentialStoreAdapter],
};
export default qflowPackage;
