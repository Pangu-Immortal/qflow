import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Browser, computeExecutablePath, install } from "@puppeteer/browsers";

export type CaptureBrowserOptions = {
  readonly version?: string;
  readonly cacheDirectory?: string;
  readonly downloadBaseUrl?: string;
};

function selection(options: CaptureBrowserOptions) {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    qflow?: { captureBrowser?: { version?: string } };
  };
  const buildId = options.version ?? manifest.qflow?.captureBrowser?.version;
  if (typeof buildId !== "string" || !/^\d+\.\d+\.\d+\.\d+$/u.test(buildId)) throw new Error("Capture browser requires an exact four-part version");
  const cacheDir = options.cacheDirectory ?? process.env.PUPPETEER_CACHE_DIR ?? join(homedir(), ".cache", "puppeteer");
  return { browser: Browser.CHROME, buildId, cacheDir };
}

export async function captureBrowserExecutablePath(options: CaptureBrowserOptions = {}): Promise<string> {
  return computeExecutablePath(selection(options));
}

/** Explicit setup, using Puppeteer's cache configuration and upstream browser installer. */
export async function installCaptureBrowser(options: CaptureBrowserOptions = {}): Promise<string> {
  if (options.downloadBaseUrl !== undefined && !["https:", "http:"].includes(new URL(options.downloadBaseUrl).protocol)) {
    throw new Error("Capture browser download source must use HTTP or HTTPS");
  }
  const installed = await install({ ...selection(options), ...(options.downloadBaseUrl === undefined ? {} : { baseUrl: options.downloadBaseUrl }) });
  return installed.executablePath;
}
