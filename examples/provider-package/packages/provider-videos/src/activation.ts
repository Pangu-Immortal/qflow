import {
  createRuntimeEndpointAdapterFacet, runtimeConfigCredentialRef, runtimeConfigExact,
  runtimeConfigObject, runtimeConfigPositiveInteger, runtimeConfigString,
} from "@qflow/runtime-local/extension";
import { createVideoProvider, providerModule } from "./provider.js";

export default {
  format: "qflow.package@1" as const,
  facets: [createRuntimeEndpointAdapterFacet({
    use: providerModule.name,
    activate(context) {
      const config = runtimeConfigObject(context.config, "Video service");
      runtimeConfigExact(config, ["baseUrl", "apiKey", "concurrency", "pollIntervalMs"], "Video service");
      const baseUrl = runtimeConfigString(config.baseUrl, "Video service baseUrl");
      const apiKey = runtimeConfigCredentialRef(config.apiKey, "Video service apiKey");
      if (!baseUrl || !apiKey || !context.pool) throw new Error("Video service requires baseUrl, apiKey and pool");
      return { endpoint: createVideoProvider({
        instance: context.instance, pool: context.pool, baseUrl, apiKey,
        concurrency: runtimeConfigPositiveInteger(config.concurrency, "concurrency") ?? 1,
        pollIntervalMs: runtimeConfigPositiveInteger(config.pollIntervalMs, "pollIntervalMs") ?? 5_000,
      }) };
    },
  })],
};
