import Module, { createRequire, findPackageJSON, isBuiltin, registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compileFunction } from "node:vm";
import { initSync, parse as parseCommonJs } from "cjs-module-lexer";
import { transpileModule, ModuleKind, ScriptTarget, JsxEmit } from "typescript";
import { isActiveDistributionHostImport } from "./distribution-resolution.js";

/** A module identity namespace, not a filesystem directory. No files are written here. */
const prefix = pathToFileURL(join(tmpdir(), ".qflow-module-scopes", String(process.pid)) + sep).href;
const bridge = "qflow-internal:module-scope";
const requestPrefix = "qflow-module-request:";
const scopes = new Map<string, NodeModuleScope>();
let serial = 0;
let installed = false;

function address(value: string | undefined): { scope: string; url: string } | undefined {
  if (value === undefined) return undefined;
  const url = isAbsolute(value) ? pathToFileURL(value).href : value;
  if (!url.startsWith(prefix)) return undefined;
  const [scope, encoded] = url.slice(prefix.length).split("/");
  if (!scope || !encoded) return undefined;
  return { scope, url: Buffer.from(encoded.slice(0, -4), "base64url").toString("utf8") };
}

function moduleUrl(scope: string, url: string): string {
  return `${prefix}${scope}/${Buffer.from(url).toString("base64url")}.mjs`;
}

function commonJsSource(filename: string): string {
  const source = readFileSync(filename, "utf8").replace(/^#!/u, "//");
  return /\.[cm]?tsx?$|\.jsx$/u.test(filename) ? transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2023, jsx: JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText : source;
}

function esmSource(filename: string): string {
  const source = readFileSync(filename, "utf8").replace(/^#!/u, "//");
  return /\.[cm]?tsx?$|\.jsx$/u.test(filename)
    ? transpileModule(source, {
      fileName: filename,
      compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2023, jsx: JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText : source;
}

function exportNames(filename: string, visited = new Set<string>()): readonly string[] {
  // Node's CJS named-export discovery does not infer names from ESM or JSON reexports.
  if (visited.has(filename) || isEsModule(filename) || extname(filename) === ".json") return [];
  visited.add(filename);
  const parsed = parseCommonJs(commonJsSource(filename));
  const require = createRequire(filename);
  return [...new Set([...parsed.exports, ...parsed.reexports.flatMap((specifier) => {
    const target = require.resolve(specifier);
    return isBuiltin(target) || target.endsWith(".node") ? Object.keys(require(specifier) as object) : exportNames(target, visited);
  })])].filter((name) => name !== "default" && name !== "module.exports");
}

function isEsModule(filename: string): boolean {
  const extension = extname(filename);
  if (extension === ".mjs" || extension === ".mts") return true;
  if (extension === ".cjs" || extension === ".cts") return false;
  const manifest = findPackageJSON(pathToFileURL(filename));
  return manifest !== undefined && (JSON.parse(readFileSync(manifest, "utf8")) as { type?: string }).type === "module";
}

function scopeFor(id: string): NodeModuleScope {
  const scope = scopes.get(id);
  if (scope === undefined) throw new Error(`Module scope ${id} has ended`);
  return scope;
}

/** Internal bridge used by Node's ESM/CommonJS interop. */
export function scopedCommonJs(id: string, filename: string): unknown { return scopeFor(id).commonJs(filename); }

function install(): void {
  if (installed) return;
  initSync();
  installed = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === bridge) return { url: import.meta.url, shortCircuit: true };
      if (specifier.startsWith(requestPrefix)) {
        const [scope, request, parentURL] = JSON.parse(Buffer.from(specifier.slice(requestPrefix.length), "base64url").toString("utf8")) as [string, string, string];
        scopeFor(scope);
        const found = nextResolve(request, { ...context, parentURL });
        return found.url.startsWith("file:") && !isActiveDistributionHostImport(request)
          ? { ...found, url: moduleUrl(scope, found.url) } : found;
      }
      const direct = address(specifier);
      const parent = address(context.parentURL);
      const scope = direct?.scope ?? parent?.scope;
      const target = direct === undefined ? specifier
        : new Set(context.conditions).has("require") ? fileURLToPath(direct.url) : direct.url;
      const found = nextResolve(target, parent ? { ...context, parentURL: parent.url } : context);
      // The installed Distribution is process code. Its package APIs remain shared; each
      // invocation still creates the Build's own registries, adapters and configuration.
      if (scope === undefined || !found.url.startsWith("file:")
        || isActiveDistributionHostImport(specifier)) return found;
      scopeFor(scope);
      return { ...found, url: moduleUrl(scope, found.url) };
    },
    load(url, context, nextLoad) {
      const item = address(url);
      if (item === undefined) return nextLoad(url, context);
      scopeFor(item.scope);
      const filename = fileURLToPath(item.url);
      // The scope owns loading its JS/TS implementation closure. It must not rely
      // on an outer TS hook recognizing the namespace's synthetic .mjs address.
      if (!/\.[cm]?[jt]sx?$/u.test(filename)) return nextLoad(item.url, { ...context, format: undefined });
      if (!isEsModule(filename)) {
        const names = exportNames(filename);
        return { format: "module", shortCircuit: true, source: [
          `import {scopedCommonJs} from ${JSON.stringify(bridge)};`,
          `const value=scopedCommonJs(${JSON.stringify(item.scope)},${JSON.stringify(filename)});`,
          "export default value; export {value as 'module.exports'};",
          ...names.map((name, i) => `const e${i}=value[${JSON.stringify(name)}];export {e${i} as ${JSON.stringify(name)}};`),
        ].join("\n") };
      }
      const source = esmSource(filename);
      // Author-visible filesystem addresses stay real, including import.meta.resolve().
      // Keep metadata restoration local: requiring a synchronous project ESM module
      // must not add an edge back into the asynchronously bootstrapped loader.
      const prelude = `import.meta.url=${JSON.stringify(item.url)};import.meta.filename=${JSON.stringify(filename)};` +
        `import.meta.dirname=${JSON.stringify(dirname(filename))};` +
        `{const resolve=import.meta.resolve;import.meta.resolve=(id)=>{const url=resolve(id);` +
        `if(!url.startsWith(${JSON.stringify(prefix)}))return url;` +
        `return globalThis.Buffer.from(url.slice(${prefix.length}).split('/')[1].slice(0,-4),'base64url').toString('utf8');};}\n`;
      return { format: "module", shortCircuit: true, source: prelude + source };
    },
  });
}

/** Independent loaded bindings in a shared trusted Node process; not a security sandbox. */
export class NodeModuleScope {
  readonly #id = String(++serial);
  readonly #commonJs: Record<string, NodeJS.Module> = Object.create(null) as Record<string, NodeJS.Module>;
  constructor() { install(); scopes.set(this.#id, this); }

  async import(url: string): Promise<unknown> { return await import(moduleUrl(this.#id, url)); }

  commonJs(filename: string, parent?: NodeJS.Module): unknown {
    const cached = this.#commonJs[filename];
    if (cached !== undefined) return cached.exports;
    const nativeRequire = createRequire(filename);
    const mod = new Module(filename, parent);
    mod.filename = filename;
    mod.path = dirname(filename);
    mod.paths = nativeRequire.resolve.paths("module") ?? [];
    const require = Object.assign((specifier: string): unknown => {
      if (isBuiltin(specifier)) return nativeRequire(specifier);
      const resolved = nativeRequire.resolve(specifier);
      if (isActiveDistributionHostImport(specifier) || resolved.endsWith(".node")) return nativeRequire(specifier);
      if (resolved.endsWith(".json")) {
        if (this.#commonJs[resolved] === undefined) {
          const json = new Module(resolved, mod);
          json.exports = JSON.parse(readFileSync(resolved, "utf8")); json.loaded = true;
          this.#commonJs[resolved] = json;
        }
        return this.#commonJs[resolved]!.exports;
      }
      if (isEsModule(resolved)) return nativeRequire(fileURLToPath(moduleUrl(this.#id, pathToFileURL(resolved).href)));
      return this.commonJs(resolved, mod);
    }, { resolve: nativeRequire.resolve, cache: this.#commonJs, extensions: nativeRequire.extensions, main: undefined }) as NodeRequire;
    mod.require = require;
    this.#commonJs[filename] = mod;
    try {
      compileFunction(commonJsSource(filename), ["exports", "require", "module", "__filename", "__dirname"], {
        filename,
        importModuleDynamically: async (specifier) => await import(requestPrefix + Buffer.from(JSON.stringify([
          this.#id, specifier, pathToFileURL(filename).href,
        ])).toString("base64url")),
      })
        .call(mod.exports, mod.exports, require, mod, filename, dirname(filename));
      mod.loaded = true;
      return mod.exports;
    } catch (error) { delete this.#commonJs[filename]; throw error; }
  }

  close(): void {
    scopes.delete(this.#id);
    for (const key of Object.keys(this.#commonJs)) delete this.#commonJs[key];
  }
}
