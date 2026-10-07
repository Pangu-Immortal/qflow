import {
  createRuntimeCredentialStoreAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
} from "@qflow/runtime-local/extension";

import { EnvironmentCredentialStore } from "./index.js";

const environmentCredentialStoreAdapter = createRuntimeCredentialStoreAdapterFacet({
  use: "@qflow/credential-store-env",
  validate(context) {
    const config = runtimeConfigObject(context.config, "environment CredentialStore");
    runtimeConfigExact(config, [], "environment CredentialStore");
  },
  open() {
    return { value: new EnvironmentCredentialStore() };
  },
});

export const qflowPackage = {
  format: "qflow.package@1" as const,
  facets: [environmentCredentialStoreAdapter],
};

export default qflowPackage;
