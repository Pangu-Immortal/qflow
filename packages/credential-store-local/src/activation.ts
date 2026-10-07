import { join, resolve } from "node:path";
import {
  createRuntimeCredentialStoreAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
  runtimeConfigString,
} from "@qflow/runtime-local/extension";
import { LocalCredentialStore } from "./store.js";

const localCredentialStoreAdapter = createRuntimeCredentialStoreAdapterFacet({
  use: "@qflow/credential-store-local",
  validate(context) {
    const config = runtimeConfigObject(context.config, "local CredentialStore");
    runtimeConfigExact(config, ["backend", "path", "service"], "local CredentialStore");
    const backend = runtimeConfigString(config.backend, "local credential backend");
    if (backend !== undefined && backend !== "system" && backend !== "file") {
      throw new Error("local credential backend must be system or file");
    }
    runtimeConfigString(config.path, "local credential path");
    runtimeConfigString(config.service, "local credential service");
  },
  open(context) {
    const config = runtimeConfigObject(context.config, "local CredentialStore");
    const backend = runtimeConfigString(config.backend, "local credential backend") as "system" | "file" | undefined;
    const path = runtimeConfigString(config.path, "local credential path");
    const service = runtimeConfigString(config.service, "local credential service");
    return {
      value: new LocalCredentialStore({
        directory: path === undefined ? join(context.hostStateRoot, "credentials") : resolve(context.hostStateRoot, path),
        ...(backend === undefined ? {} : { backend }),
        ...(service === undefined ? {} : { service }),
      }),
    };
  },
});

export const qflowPackage = {
  format: "qflow.package@1" as const,
  facets: [localCredentialStoreAdapter],
};
export default qflowPackage;
