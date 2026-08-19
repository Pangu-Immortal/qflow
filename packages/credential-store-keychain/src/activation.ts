import {
  createRuntimeCredentialStoreAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
  runtimeConfigString,
} from "@qflow/runtime-kit";

import { KeychainCredentialStore } from "./store.js";

const keychainCredentialStoreRuntimeAdapter = createRuntimeCredentialStoreAdapterFacet({
  use: "@qflow/credential-store-keychain",
  validate(context) {
    const config = runtimeConfigObject(context.config, "keychain CredentialStore");
    runtimeConfigExact(config, ["service"], "keychain CredentialStore");
    runtimeConfigString(config.service, "keychain service");
  },
  open(context) {
    const config = runtimeConfigObject(context.config, "keychain CredentialStore");
    runtimeConfigExact(config, ["service"], "keychain CredentialStore");
    return { value: new KeychainCredentialStore({
      ...(runtimeConfigString(config.service, "keychain service") === undefined
        ? {} : { service: config.service as string }),
    }) };
  },
});

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [keychainCredentialStoreRuntimeAdapter],
};

export default qflowPackage;
