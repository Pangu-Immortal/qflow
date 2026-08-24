import {
  createRuntimeCredentialStoreAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
  runtimeConfigString,
} from "@qflow/runtime-kit";

import { OsCredentialStore } from "./store.js";

const osCredentialStoreRuntimeAdapter = createRuntimeCredentialStoreAdapterFacet({
  use: "@qflow/credential-store-os",
  validate(context) {
    const config = runtimeConfigObject(context.config, "OS CredentialStore");
    runtimeConfigExact(config, ["service"], "OS CredentialStore");
    runtimeConfigString(config.service, "OS credential service");
  },
  open(context) {
    const config = runtimeConfigObject(context.config, "OS CredentialStore");
    runtimeConfigExact(config, ["service"], "OS CredentialStore");
    return { value: new OsCredentialStore({
      ...(runtimeConfigString(config.service, "OS credential service") === undefined
        ? {} : { service: config.service as string }),
    }) };
  },
});

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [osCredentialStoreRuntimeAdapter],
};

export default qflowPackage;
