import {
  createRuntimeEndpointAdapterFacet,
  runtimeConfigCredentialRef,
  runtimeConfigExact,
  runtimeConfigBoolean,
  runtimeConfigObject,
  runtimeConfigPositiveInteger,
  runtimeConfigString,
} from "@qflow/runtime-kit";

import { createQflowHubProvider, diagnoseQflowHubProvider } from "./provider.js";

const adapter = createRuntimeEndpointAdapterFacet({
  use: "@qflow/provider-qflowhub",
  activate(context) {
    if (context.pool === undefined) throw new Error("QflowHub Provider Pool is required");
    const config = runtimeConfigObject(context.config, "QflowHub");
    runtimeConfigExact(config, [
      "baseUrl", "apiKey", "defaultConcurrency", "pollIntervalMs", "requestTimeoutMs", "audio",
      "transcriptionModel",
    ], "QflowHub");
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
    const transcriptionModel = runtimeConfigString(config.transcriptionModel, "QflowHub transcriptionModel");
    const options = {
        instance: context.instance,
        pool: context.pool,
        ...(baseUrl === undefined ? {} : { baseUrl }),
        apiKey,
        ...(defaultConcurrency === undefined ? {} : { defaultConcurrency }),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
        ...(requestTimeoutMs === undefined ? {} : { requestTimeoutMs }),
        ...(audio === undefined ? {} : { audio }),
        ...(transcriptionModel === undefined ? {} : { transcriptionModel }),
      };
    return {
      endpoint: createQflowHubProvider(options),
      diagnose: async (doctor) => await diagnoseQflowHubProvider(options, doctor),
    };
  },
});

export const qflowPackage = {
  format: "qflow.node-package@1" as const,
  hostFacets: [adapter],
};

export default qflowPackage;
