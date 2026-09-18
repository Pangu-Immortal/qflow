import type { BlobRef } from "@qflow/protocol";
import { isResourceId } from "@qflow/protocol";
import type { HyperframesCanvas, HyperframesFrameDomain } from "./types.js";

/** An already materialized HTML programme and the local files its URLs address. */
export type HyperframesHtmlProject = {
  readonly html: string;
  readonly assets: readonly { readonly url: string; readonly artifact: BlobRef }[];
};

/** Read the exact clock emitted by this package. Seconds never reconstruct frame identity. */
export function hyperframesHtmlDomain(html: string): HyperframesFrameDomain & { readonly canvas: HyperframesCanvas } {
  const roots = [...html.matchAll(/<[^!][^>]*\sdata-composition-id="[^"]*"[^>]*>/gu)];
  if (roots.length !== 1) throw new Error("Snapshot HTML needs exactly one compiled HyperFrames composition root");
  const attribute = (name: string) => {
    const value = new RegExp(`\\s${name}="([^"]*)"`, "u").exec(roots[0]![0])?.[1];
    if (value === undefined) throw new Error(`Snapshot HTML lacks ${name}; use the compiled HyperFrames HTML`);
    return value;
  };
  const positive = (value: string, name: string) => {
    const number = Number(value);
    if (!/^\d+$/u.test(value) || !Number.isSafeInteger(number) || number <= 0) throw new Error(`Invalid HyperFrames ${name}`);
    return number;
  };
  const fps = attribute("data-fps").split("/");
  if (fps.length > 2) throw new Error("HyperFrames data-fps must be an exact rational");
  return {
    frameRate: { numerator: positive(fps[0]!, "frame rate"), denominator: positive(fps[1] ?? "1", "frame rate denominator") },
    frameCount: positive(attribute("data-qflow-frame-count"), "frame count"),
    canvas: { width: positive(attribute("data-width"), "width"), height: positive(attribute("data-height"), "height") },
  };
}

function unescape(value: string): string {
  return value.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

/** Resource URL positions in the compiler's self-contained HTML (inline JS and CSS). */
export function mapHyperframesHtmlUrls(html: string, map: (url: string) => string): string {
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const cssUrls = (css: string) => css.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gu,
    (_all, _quote: string, url: string) => `url("${map(url.trim()).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}")`);
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gu,
    (_all, attributes: string, css: string) => `<style${attributes}>${cssUrls(css)}</style>`)
    .replace(/<[a-z][^>]*>/gu, tag => {
      const attributes = /^(?:<(?:img|video|source|image|use|script|link)\b)/u.test(tag)
        ? tag.replace(/\s(src|poster|href)="([^"]*)"/gu,
          (_all, key: string, url: string) => ` ${key}="${escape(map(unescape(url)))}"`) : tag;
      return attributes.replace(/\sstyle="([^"]*)"/gu,
        (_all, css: string) => ` style="${escape(cssUrls(unescape(css)))}"`);
    });
}

export function hyperframesHtmlAssetUrls(html: string): readonly string[] {
  const urls = new Set<string>();
  mapHyperframesHtmlUrls(html, url => {
    if (url !== "" && !url.startsWith("#") && !url.startsWith("data:")) urls.add(url);
    return url;
  });
  return [...urls];
}

export function assertHyperframesHtmlProject(value: unknown): asserts value is HyperframesHtmlProject {
  const project = value as HyperframesHtmlProject;
  if (!project || typeof project.html !== "string" || !Array.isArray(project.assets)) throw new Error("HyperFrames HTML project needs html and assets");
  hyperframesHtmlDomain(project.html);
  if (/qflow-resource:\/\//u.test(project.html)) throw new Error("HTML still has unresolved resources; materialize its HyperframesDocument first");
  const urls = new Set<string>();
  for (const asset of project.assets) {
    const blob = asset?.artifact;
    if (typeof asset?.url !== "string" || urls.has(asset.url) || blob?.kind !== "blob" || !isResourceId(blob.resource)
      || !Number.isSafeInteger(blob.size) || blob.size < 0 || typeof blob.mediaType !== "string" || !blob.mediaType) {
      throw new Error("Invalid or repeated HyperFrames HTML asset");
    }
    urls.add(asset.url);
  }
  const referenced = hyperframesHtmlAssetUrls(project.html);
  if (referenced.length !== urls.size || referenced.some(url => !urls.has(url))) throw new Error("HyperFrames HTML assets must address its referenced URLs");
}
