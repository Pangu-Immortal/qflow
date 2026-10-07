import { resolve } from "node:path";
import {
  createRuntimeEndpointAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
  runtimeConfigPositiveInteger,
  runtimeConfigString,
} from "@qflow/runtime-local/extension";

import { createLocalWhisperXProvider, localWhisperXDefaults } from "./provider.js";
import { localWhisperXProgram } from "./program.js";

const localWhisperXRuntimeAdapter = createRuntimeEndpointAdapterFacet({
  use: "@qflow/provider-whisperx-local",
  activate(context) {
    if (context.pool === undefined) throw new Error("WhisperX Provider Pool is required");
    const config = runtimeConfigObject(context.config, "local WhisperX");
    runtimeConfigExact(config, [
      "baseUrl", "expectedModel", "expectedDevice", "expectedCompute", "expectedBatchSize",
      "expectedServiceVersion", "expectedWhisperXVersion",
      "defaultConcurrency", "requestTimeoutMs", "maxResponseBytes",
      "serviceCommand", "alignmentLanguages", "modelCacheDirectory",
    ], "local WhisperX");
    const baseUrl = runtimeConfigString(config.baseUrl, "WhisperX baseUrl");
    if (baseUrl !== undefined) {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== "http:"
        || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname)) {
        throw new Error("local WhisperX Provider requires a loopback HTTP service");
      }
    }
    const expectedModel = runtimeConfigString(config.expectedModel, "WhisperX expectedModel");
    const expectedDevice = runtimeConfigString(config.expectedDevice, "WhisperX expectedDevice");
    const expectedCompute = runtimeConfigString(config.expectedCompute, "WhisperX expectedCompute");
    const expectedBatchSize = runtimeConfigPositiveInteger(config.expectedBatchSize, "WhisperX expectedBatchSize");
    const expectedServiceVersion = runtimeConfigString(config.expectedServiceVersion, "WhisperX expectedServiceVersion");
    const expectedWhisperXVersion = runtimeConfigString(config.expectedWhisperXVersion, "WhisperX expectedWhisperXVersion");
    const defaultConcurrency = runtimeConfigPositiveInteger(config.defaultConcurrency, "WhisperX defaultConcurrency");
    const requestTimeoutMs = runtimeConfigPositiveInteger(config.requestTimeoutMs, "WhisperX requestTimeoutMs");
    const maxResponseBytes = runtimeConfigPositiveInteger(config.maxResponseBytes, "WhisperX maxResponseBytes");
    const modelCacheDirectory = runtimeConfigString(config.modelCacheDirectory, "WhisperX modelCacheDirectory");
    const alignmentLanguages = config.alignmentLanguages;
    if (alignmentLanguages !== undefined && (!Array.isArray(alignmentLanguages)
      || alignmentLanguages.some((item) => typeof item !== "string" || !/^[a-z]+$/u.test(item)))) {
      throw new Error("WhisperX alignmentLanguages must be an array of lowercase language codes");
    }
    const serviceCommandValue = config.serviceCommand;
    if (serviceCommandValue !== undefined
      && (!Array.isArray(serviceCommandValue) || serviceCommandValue.length === 0
        || serviceCommandValue.some((item) => typeof item !== "string" || item.length === 0))) {
      throw new Error("WhisperX serviceCommand must be a non-empty array of non-empty strings");
    }
    const selectedBaseUrl = baseUrl ?? localWhisperXDefaults.baseUrl;
    const selectedModel = expectedModel ?? localWhisperXDefaults.expectedModel;
    const selectedDevice = expectedDevice ?? localWhisperXDefaults.expectedDevice;
    const selectedCompute = expectedCompute ?? (selectedDevice === "cpu" ? "int8" : "float16");
    const selectedBatchSize = expectedBatchSize ?? localWhisperXDefaults.expectedBatchSize;
    const selectedServiceVersion = expectedServiceVersion ?? localWhisperXDefaults.expectedServiceVersion;
    const selectedWhisperXVersion = expectedWhisperXVersion ?? localWhisperXDefaults.expectedWhisperXVersion;
    const serviceCommand = serviceCommandValue === undefined ? undefined : {
      command: serviceCommandValue[0] as string,
      args: (serviceCommandValue as string[]).slice(1),
    };
    return {
      endpoint: createLocalWhisperXProvider({
        instance: context.instance,
        pool: context.pool,
        baseUrl: selectedBaseUrl,
        expectedModel: selectedModel,
        expectedDevice: selectedDevice,
        expectedCompute: selectedCompute,
        expectedBatchSize: selectedBatchSize,
        expectedServiceVersion: selectedServiceVersion,
        expectedWhisperXVersion: selectedWhisperXVersion,
        ...(defaultConcurrency === undefined ? {} : { defaultConcurrency }),
        ...(requestTimeoutMs === undefined ? {} : { requestTimeoutMs }),
        ...(maxResponseBytes === undefined ? {} : { maxResponseBytes }),
      }),
      program: localWhisperXProgram({
        id: context.instance,
        hostStateRoot: context.hostStateRoot,
        baseUrl: selectedBaseUrl,
        expectedModel: selectedModel,
        expectedDevice: selectedDevice,
        expectedCompute: selectedCompute,
        expectedBatchSize: selectedBatchSize,
        expectedServiceVersion: selectedServiceVersion,
        expectedWhisperXVersion: selectedWhisperXVersion,
        ...(serviceCommand === undefined ? {} : { serviceCommand }),
        ...(alignmentLanguages === undefined ? {} : { alignmentLanguages: alignmentLanguages as string[] }),
        ...(modelCacheDirectory === undefined ? {} : { modelCacheDirectory: resolve(context.dataRoot, modelCacheDirectory) }),
      }),
    };
  },
});

export const qflowPackage = {
  format: "qflow.package@1" as const,
  facets: [localWhisperXRuntimeAdapter],
};

export default qflowPackage;
