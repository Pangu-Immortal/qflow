import {
  createRuntimeEndpointAdapterFacet, runtimeConfigCredentialRef, runtimeConfigExact,
  runtimeConfigObject, runtimeConfigPositiveInteger, runtimeConfigString,
} from "@qflow/qflow/runtime-kit";
import { createImageProvider, providerModule } from "./provider.js";

export default {
  format: "qflow.node-package@1" as const,
  hostFacets: [createRuntimeEndpointAdapterFacet({
    use: providerModule.name,
    activate(context) {
      const config = runtimeConfigObject(context.config, "Image service");
      runtimeConfigExact(config, ["baseUrl", "apiKey", "concurrency", "pollIntervalMs"], "Image service");
      const baseUrl = runtimeConfigString(config.baseUrl, "Image service baseUrl");
      const apiKey = runtimeConfigCredentialRef(config.apiKey, "Image service apiKey");
      if (!baseUrl || !apiKey || !context.pool) throw new Error("Image service requires baseUrl, apiKey and pool");
      return { endpoint: createImageProvider({
        instance: context.instance, pool: context.pool, baseUrl, apiKey,
        concurrency: runtimeConfigPositiveInteger(config.concurrency, "concurrency") ?? 1,
        pollIntervalMs: runtimeConfigPositiveInteger(config.pollIntervalMs, "pollIntervalMs") ?? 2_000,
      }) };
    },
  })],
};
