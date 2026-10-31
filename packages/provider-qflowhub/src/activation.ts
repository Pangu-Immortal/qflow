import {
  createRuntimeEndpointAdapterFacet,
  runtimeConfigCredentialRef,
  runtimeConfigActionLimits,
  runtimeConfigExact,
  runtimeConfigObject,
  runtimeConfigPositiveInteger,
  runtimeConfigString,
} from "@qflow/runtime-local/extension";

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
      "actionLimits",
      "capabilityConcurrency",
      "pollIntervalMs",
      "requestTimeoutMs",
      "oauthRequestTimeoutMs",
      "pricingRequestTimeoutMs",
      "operationTimeoutMs",
      "uploadConcurrency",
      "uploadPartTimeoutMs",
      "uploadPartAttempts",
      "downloadAttempts",
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
    const actionLimits = runtimeConfigActionLimits(config.actionLimits);
    const defaultConcurrency = runtimeConfigPositiveInteger(config.defaultConcurrency, "QflowHub defaultConcurrency");
    const pollIntervalMs = runtimeConfigPositiveInteger(config.pollIntervalMs, "QflowHub pollIntervalMs");
    const requestTimeoutMs = runtimeConfigPositiveInteger(config.requestTimeoutMs, "QflowHub requestTimeoutMs");
    const oauthRequestTimeoutMs = runtimeConfigPositiveInteger(config.oauthRequestTimeoutMs, "QflowHub oauthRequestTimeoutMs");
    const pricingRequestTimeoutMs = runtimeConfigPositiveInteger(config.pricingRequestTimeoutMs, "QflowHub pricingRequestTimeoutMs");
    const operationTimeoutMs = runtimeConfigPositiveInteger(config.operationTimeoutMs, "QflowHub operationTimeoutMs");
    const uploadConcurrency = runtimeConfigPositiveInteger(config.uploadConcurrency, "QflowHub uploadConcurrency");
    const uploadPartTimeoutMs = runtimeConfigPositiveInteger(config.uploadPartTimeoutMs, "QflowHub uploadPartTimeoutMs");
    const uploadPartAttempts = runtimeConfigPositiveInteger(config.uploadPartAttempts, "QflowHub uploadPartAttempts");
    const downloadAttempts = runtimeConfigPositiveInteger(config.downloadAttempts, "QflowHub downloadAttempts");
    const transcriptionModel = runtimeConfigString(config.transcriptionModel, "QflowHub transcriptionModel");
    const capabilityConcurrency = config.capabilityConcurrency === undefined ? undefined : Object.fromEntries(
      Object.entries(runtimeConfigObject(config.capabilityConcurrency, "QflowHub capabilityConcurrency"))
        .map(([name, value]) => [name, runtimeConfigPositiveInteger(value, `QflowHub ${name} capacity`)!]),
    );
    const options = {
        instance: context.instance,
        pool: context.pool,
        ...(baseUrl === undefined ? {} : { baseUrl }),
        apiKey,
        ...(defaultConcurrency === undefined ? {} : { defaultConcurrency }),
        ...(actionLimits === undefined ? {} : { actionLimits }),
        ...(capabilityConcurrency === undefined ? {} : { capabilityConcurrency }),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
        ...(requestTimeoutMs === undefined ? {} : { requestTimeoutMs }),
        ...(oauthRequestTimeoutMs === undefined ? {} : { oauthRequestTimeoutMs }),
        ...(pricingRequestTimeoutMs === undefined ? {} : { pricingRequestTimeoutMs }),
        ...(operationTimeoutMs === undefined ? {} : { operationTimeoutMs }),
        ...(uploadConcurrency === undefined ? {} : { uploadConcurrency }),
        ...(uploadPartTimeoutMs === undefined ? {} : { uploadPartTimeoutMs }),
        ...(uploadPartAttempts === undefined ? {} : { uploadPartAttempts }),
        ...(downloadAttempts === undefined ? {} : { downloadAttempts }),
        ...(transcriptionModel === undefined ? {} : { transcriptionModel }),
      };
    return {
      endpoint: createQflowHubProvider(options),
      diagnose: async (doctor) => await diagnoseQflowHubProvider(options, doctor),
    };
  },
});

export const qflowPackage = {
  format: "qflow.package@1" as const,
  facets: [adapter],
};

export default qflowPackage;
