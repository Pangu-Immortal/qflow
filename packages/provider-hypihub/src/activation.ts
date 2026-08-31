import {
  createRuntimeEndpointAdapterFacet,
  runtimeConfigCredentialRef,
  runtimeConfigExact,
  runtimeConfigBoolean,
  runtimeConfigObject,
  runtimeConfigPositiveInteger,
  runtimeConfigString,
} from "@qflow/runtime-kit";

import { createQflowHubProvider } from "./provider.js";

const adapter = createRuntimeEndpointAdapterFacet({
  use: "@qflow/provider-qflowhub",
  activate(context) {
    if (context.pool === undefined) throw new Error("QflowHub Provider Pool is required");
    const config = runtimeConfigObject(context.config, "QflowHub");
    runtimeConfigExact(config, ["baseUrl", "apiKey", "defaultConcurrency", "pollIntervalMs", "requestTimeoutMs", "audio"], "QflowHub");
    const baseUrl = runtimeConfigString(config.baseUrl, "QflowHub baseUrl");
    if (baseUrl !== undefined) {
      const url = new URL(baseUrl);
      if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        throw new Error("QflowHub baseUrl must use HTTPS or loopback");
      }
    }
    const apiKey = runtimeConfigCredentialRef(config.apiKey, "QflowHub apiKey");
    if (apiKey === undefined) throw new Error("QflowHub apiKey CredentialRef is required");
    const defaultConcurrency = runtimeConfigPositiveInteger(config.defaultConcurrency, "QflowHub defaultConcurrency");
    const pollIntervalMs = runtimeConfigPositiveInteger(config.pollIntervalMs, "QflowHub pollIntervalMs");
    const requestTimeoutMs = runtimeConfigPositiveInteger(config.requestTimeoutMs, "QflowHub requestTimeoutMs");
    const audio = runtimeConfigBoolean(config.audio, "QflowHub audio");
    return {
      endpoint: createQflowHubProvider({
        instance: context.instance,
        pool: context.pool,
        ...(baseUrl === undefined ? {} : { baseUrl }),
        apiKey,
        ...(defaultConcurrency === undefined ? {} : { defaultConcurrency }),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
        ...(requestTimeoutMs === undefined ? {} : { requestTimeoutMs }),
        ...(audio === undefined ? {} : { audio }),
      }),
    };
  },
});

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [adapter],
};

export default qflowPackage;
