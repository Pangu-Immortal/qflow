import {
  createRuntimeEndpointAdapterFacet,
  runtimeConfigCredentialRef,
  runtimeConfigExact,
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
      "baseUrl",
      "apiKey",
      "defaultConcurrency",
      "pollIntervalMs",
      "requestTimeoutMs",
      "operationTimeoutMs",
      "uploadPartTimeoutMs",
      "uploadPartAttempts",
      "downloadAttempts",
      "geminiRateLimitAttempts",
      "geminiRateLimitRetryDelayMs",
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
    const operationTimeoutMs = runtimeConfigPositiveInteger(config.operationTimeoutMs, "QflowHub operationTimeoutMs");
    const uploadPartTimeoutMs = runtimeConfigPositiveInteger(config.uploadPartTimeoutMs, "QflowHub uploadPartTimeoutMs");
    const uploadPartAttempts = runtimeConfigPositiveInteger(config.uploadPartAttempts, "QflowHub uploadPartAttempts");
    const downloadAttempts = runtimeConfigPositiveInteger(config.downloadAttempts, "QflowHub downloadAttempts");
    const geminiRateLimitAttempts = runtimeConfigPositiveInteger(config.geminiRateLimitAttempts, "QflowHub geminiRateLimitAttempts");
    const geminiRateLimitRetryDelayMs = runtimeConfigPositiveInteger(config.geminiRateLimitRetryDelayMs, "QflowHub geminiRateLimitRetryDelayMs");
    const transcriptionModel = runtimeConfigString(config.transcriptionModel, "QflowHub transcriptionModel");
    const options = {
        instance: context.instance,
        pool: context.pool,
        ...(baseUrl === undefined ? {} : { baseUrl }),
        apiKey,
        ...(defaultConcurrency === undefined ? {} : { defaultConcurrency }),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
        ...(requestTimeoutMs === undefined ? {} : { requestTimeoutMs }),
        ...(operationTimeoutMs === undefined ? {} : { operationTimeoutMs }),
        ...(uploadPartTimeoutMs === undefined ? {} : { uploadPartTimeoutMs }),
        ...(uploadPartAttempts === undefined ? {} : { uploadPartAttempts }),
        ...(downloadAttempts === undefined ? {} : { downloadAttempts }),
        ...(geminiRateLimitAttempts === undefined ? {} : { geminiRateLimitAttempts }),
        ...(geminiRateLimitRetryDelayMs === undefined ? {} : { geminiRateLimitRetryDelayMs }),
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
