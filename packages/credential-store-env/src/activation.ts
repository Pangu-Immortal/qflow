import {
  createRuntimeCredentialStoreAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
} from "@qflow/runtime-kit";

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
  format: "qflow.node-package@1" as const,
  hostFacets: [environmentCredentialStoreAdapter],
};

export default qflowPackage;
