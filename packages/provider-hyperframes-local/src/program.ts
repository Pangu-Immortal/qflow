import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { probeMediaToolchain } from "@qflow/media-execution";
import type { ManagedProgram, ManagedProgramState } from "@qflow/runtime-kit";
import { browserCacheDirectory, browserDownloadBaseUrl, browserDownloadUrl, browserExecutablePath, configuredBrowserPath, requireBrowserExecutable, selectedBrowserVersion } from "./browser.js";
import type { BrowserOptions } from "./browser.js";
import { processEnvironment } from "./process.js";

/**
 * This Provider owns browser selection and preparation. Probes never install;
 * rendering receives the same selected executable instead of invoking engine discovery.
 */
export function localHyperframesBrowserProgram(
  input: BrowserOptions & {
    readonly id: string;
    readonly nodePath: string;
    readonly ffprobePath: string;
    readonly ffmpegPath?: string;
  },
): ManagedProgram {
  const version = selectedBrowserVersion(input);
  const selectedPath = browserExecutablePath(input);
  const baseUrl = browserDownloadBaseUrl(input);
  const probeBrowser = async (): Promise<ManagedProgramState> => {
    try { await requireBrowserExecutable(selectedPath, version); }
    catch (error) { return { state: "down", detail: error instanceof Error ? error.message : String(error) }; }
    return { state: "ready" };
  };
  return {
    id: input.id,
    ...(configuredBrowserPath(input) === undefined ? {
      // Projects sharing this installation also share the existing Program lifecycle lock/logs.
      stateRoot: join(browserCacheDirectory(input), ".qflow-render-program"),
      installation: {
        probe: probeBrowser,
        commands: [{ label: `Install Chrome Headless Shell ${version} at ${selectedPath} from ${browserDownloadUrl(input)}`, command: input.nodePath, args: [
          "--import", import.meta.resolve("tsx"),
          "--import", new URL("./capture-bootstrap.ts", import.meta.url).href,
          fileURLToPath(new URL("./browser-install.ts", import.meta.url)), browserCacheDirectory(input), version!,
          ...(baseUrl === undefined ? [] : [baseUrl]),
        ] }],
      },
    } : {}),
    async probe(): Promise<ManagedProgramState> {
      const browser = await probeBrowser();
      if (browser.state !== "ready") return browser;
      const media = await probeMediaToolchain({ environment: processEnvironment(), ffprobePath: input.ffprobePath, ...(input.ffmpegPath === undefined ? {} : { ffmpegPath: input.ffmpegPath }) });
      return media.state === "ready"
        ? { state: "ready" }
        : { state: media.state, detail: media.detail };
    },
  };
}
