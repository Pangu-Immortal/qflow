import { join, resolve } from "node:path";
import {
  createRuntimeCredentialStoreAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
  runtimeConfigString,
} from "@qflow/runtime-kit";
import { PlatformCredentialStore } from "./store.js";

const platformCredentialStoreAdapter = createRuntimeCredentialStoreAdapterFacet({
  use: "@qflow/credential-store-platform",
  validate(context) {
    const config = runtimeConfigObject(context.config, "platform CredentialStore");
    runtimeConfigExact(config, ["path", "service"], "platform CredentialStore");
    runtimeConfigString(config.path, "platform credential path");
    runtimeConfigString(config.service, "platform credential service");
  },
  open(context) {
    const config = runtimeConfigObject(context.config, "platform CredentialStore");
    const path = runtimeConfigString(config.path, "platform credential path");
    const service = runtimeConfigString(config.service, "platform credential service");
    return {
      value: new PlatformCredentialStore({
        // The file fallback lands in the same directory the file Store uses by default, so a Profile
        // that switches between them on a host without a locker finds the credential it stored.
        directory: path === undefined
          ? join(context.hostStateRoot, "credentials")
          : resolve(context.hostStateRoot, path),
        ...(service === undefined ? {} : { service }),
      }),
    };
  },
});

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [platformCredentialStoreAdapter],
};
export default qflowPackage;
