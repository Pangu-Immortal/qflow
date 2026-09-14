import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, resolve } from "node:path";
import type { Plugin } from "vite";
import { builtinLanguages, languageCoverage, readLanguagePack } from "./localization.js";
import type { LanguagePack } from "./localization.js";

export async function loadLanguagePack(specifier: string, cwd: string, packageRoot: string): Promise<LanguagePack> {
  const path = isAbsolute(specifier) || specifier.startsWith(".")
    ? resolve(cwd, specifier)
    : createRequire(resolve(packageRoot, "package.json")).resolve(specifier);
  try { return readLanguagePack(JSON.parse(await readFile(path, "utf8"))); }
  catch (error) { throw new Error(`Language pack ${specifier}: ${error instanceof Error ? error.message : String(error)}`); }
}

export function describeLanguagePack(pack: LanguagePack): string {
  const { missing, unknown } = languageCoverage(pack);
  return [`${pack.name} (${pack.locale})`,
    `Missing translations (${missing.length}; English is used): ${missing.join(", ") || "none"}`,
    `Unknown message IDs (${unknown.length}): ${unknown.join(", ") || "none"}`,
  ].join("\n");
}

export async function studioLanguages(specifiers: readonly string[], cwd: string, packageRoot: string): Promise<readonly LanguagePack[]> {
  const packs = new Map(builtinLanguages.map(pack => [pack.locale, pack]));
  for (const specifier of specifiers) {
    const pack = await loadLanguagePack(specifier, cwd, packageRoot);
    packs.set(pack.locale, pack);
  }
  return [...packs.values()];
}

export function studioLocalizationPlugin(packs: readonly LanguagePack[]): Plugin {
  return {
    name: "qflow-studio-localization",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (new URL(request.url ?? "/", "http://localhost").pathname !== "/__studio/locales") return next();
        if (request.method !== "GET") { response.statusCode = 405; response.end(); return; }
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify(packs));
      });
    },
  };
}
