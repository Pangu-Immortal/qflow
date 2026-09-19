import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import type { CliIo } from "@qflow/cli";
import { assertHyperframesDocument, hyperframesHtmlAssetUrls, hyperframesHtmlDomain } from "@qflow/hyperframes";
import type { HyperframesDocument, HyperframesHtmlProject } from "@qflow/hyperframes";
import { FileResourceStore } from "@qflow/resource-store-fs";
import { hyperframesFramesRequest, renderHyperframesCapabilities, renderHyperframesTypes, verifyHyperframesFrames } from "@qflow/render-hyperframes";
import type { Need } from "@qflow/protocol";
import { creationEnvironment, selectedProvider, providerLine, providerView } from "./creation.js";
import type { CreationEnvironment } from "./creation.js";
import { snapshotFrameLabel, writeFrameGrid } from "./frame-grid.js";

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".mp4": "video/mp4", ".webm": "video/webm", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
};

async function readProject(source: string, html: string, resources: FileResourceStore): Promise<HyperframesHtmlProject> {
  const assets = [];
  const base = isSnapshotHtmlUrl(source) ? new URL(source) : pathToFileURL(source);
  for (const url of hyperframesHtmlAssetUrls(html)) {
    const address = new URL(url, base);
    let mediaType: string | undefined;
    let stream: Readable;
    if (address.protocol === "file:") {
      if (base.protocol !== "file:") throw new Error(`Network HTML cannot read local asset ${url}`);
      const path = fileURLToPath(address);
      mediaType = MEDIA_TYPES[extname(path).toLowerCase()];
      if (mediaType === undefined) throw new Error(`Unsupported snapshot asset ${url}; use compiled HTML with inline scripts and styles`);
      stream = createReadStream(path);
    } else if (address.protocol === "http:" || address.protocol === "https:") {
      const response = await fetch(address);
      if (!response.ok || response.body === null) throw new Error(`Snapshot asset ${url}: HTTP ${response.status}`);
      mediaType = response.headers.get("content-type")?.split(";")[0]?.trim();
      if (mediaType === undefined || !Object.values(MEDIA_TYPES).includes(mediaType)) {
        await response.body.cancel();
        throw new Error(`Unsupported snapshot asset ${url} (${mediaType}); use compiled HTML with inline scripts and styles`);
      }
      stream = Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>);
    } else throw new Error(`Unsupported snapshot asset protocol ${address.protocol}`);
    try { assets.push({ url, artifact: await resources.putStream(stream, mediaType) }); }
    finally { stream.destroy(); }
  }
  return { html, assets };
}

const OPTIONS = ["--studio", "--to", "--at-frame", "--start-frame", "--end-frame-exclusive", "--step-frames", "--grid", "--cell", "--runtime", "--workspace"];

/** Capture already treats HTTP(S) case-insensitively; snapshot must not turn HTTPS:// into a local path. */
export function isSnapshotHtmlUrl(value: string): boolean {
  return /^https?:\/\//iu.test(value);
}

/** `--studio` is a base URL, not a host:port token. `new URL` otherwise throws TypeError. */
export function studioDocumentUrl(studio: string): string {
  try {
    return new URL("/__studio/document", studio).href;
  } catch {
    throw new Error(`--studio needs an http(s) Studio URL, got ${studio}`);
  }
}

export function writeSnapshotHelp(io: CliIo): void {
  io.write(`qflow snapshot\nCapture exact frames from an existing compiled HyperFrames HTML programme through the selected Runtime Profile.\n\n`
    + `  qflow snapshot --studio <studio-url> --at-frame <n[,n,…]> --to <directory>\n`
    + `  qflow snapshot <index.html|HTML-URL> --at-frame <n[,n,…]> --to <directory>\n`
    + `  qflow snapshot <index.html|HTML-URL> --start-frame <n> --end-frame-exclusive <n> [--step-frames <n>] --to <directory>\n`
    + `      [--grid <columns>x<rows>] [--cell <pixels>] [--runtime <profile>] [--workspace <project>] [--json]\n\n`
    + `Frame indices are zero-based on the original programme clock. Ranges exclude the end.\n`
    + `Writes full-size PNGs and optional paginated grids. --cell controls grid image width (default 480).\n`
    + `Uses render-frames, one immediate request. Browser preparation belongs to the selected Provider.\n`
    + `HTML carries the compiled frame clock and media/font URLs; scripts and styles are inline.\nStudio exposes its current programme at http://<host>:<port>/__studio/visual.html.\n`);
}

export async function runSnapshotCli(argv: readonly string[], io: CliIo, environment: CreationEnvironment = creationEnvironment()): Promise<void> {
  if (argv.includes("--help")) { writeSnapshotHelp(io); return; }
  const options = new Map<string, string>();
  const positionals = [];
  const json = argv.includes("--json");
  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index]!;
    if (["--json", "--debug", "--verbose", "--no-color"].includes(arg)) continue;
    if (arg === "--color") { index++; continue; }
    if (!arg.startsWith("--")) { positionals.push(arg); continue; }
    if (!OPTIONS.includes(arg)) throw new Error(`Unknown snapshot option ${arg}`);
    if (options.has(arg)) throw new Error(`${arg} cannot be repeated`);
    const value = argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
    options.set(arg, value);
  }
  const studio = options.get("--studio");
  if (positionals.length !== (studio === undefined ? 1 : 0) || !options.has("--to")) throw new Error("snapshot takes one HTML input or --studio <url>, and --to <directory>");
  const integer = (raw: string | undefined, label: string, minimum = 0): number => {
    if (raw === undefined || !/^\d+$/u.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < minimum) throw new Error(`${label} needs an integer >= ${minimum}`);
    return Number(raw);
  };
  const source = studio === undefined
    ? isSnapshotHtmlUrl(positionals[0]!) ? positionals[0]! : resolve(environment.cwd, positionals[0]!)
    : studioDocumentUrl(studio);
  let document: HyperframesDocument | undefined;
  let html: string;
  if (studio !== undefined) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Studio programme: HTTP ${response.status} ${await response.text()}`);
    document = await response.json() as HyperframesDocument;
    assertHyperframesDocument(document);
    html = document.html;
  } else if (isSnapshotHtmlUrl(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Snapshot HTML: HTTP ${response.status} ${await response.text()}`);
    html = await response.text();
  } else html = await readFile(source, "utf8");
  const domain = document ?? hyperframesHtmlDomain(html);
  const explicit = options.get("--at-frame");
  let frames: number[];
  if (explicit !== undefined) {
    if (["--start-frame", "--end-frame-exclusive", "--step-frames"].some(key => options.has(key))) throw new Error("Choose --at-frame or a frame range");
    frames = explicit.split(",").map(value => integer(value, "--at-frame"));
  } else {
    const start = integer(options.get("--start-frame"), "--start-frame");
    const end = integer(options.get("--end-frame-exclusive"), "--end-frame-exclusive");
    const step = integer(options.get("--step-frames") ?? "1", "--step-frames", 1);
    if (end <= start || end > domain.frameCount) throw new Error(`The frame range must satisfy 0 <= start < end <= ${domain.frameCount}`);
    frames = Array.from({ length: Math.ceil((end - start) / step) }, (_, index) => start + index * step);
  }
  const grid = options.get("--grid")?.split("x");
  if (grid !== undefined && grid.length !== 2) throw new Error("--grid needs columns x rows, for example 4x3");
  const columns = grid === undefined ? undefined : integer(grid[0], "grid columns", 1);
  const rows = grid === undefined ? undefined : integer(grid[1], "grid rows", 1);
  if (options.has("--cell") && grid === undefined) throw new Error("--cell requires --grid");
  const cell = integer(options.get("--cell") ?? "480", "--cell", 32);
  const to = resolve(environment.cwd, options.get("--to")!);
  if (await stat(to).then(() => true, () => false)) throw new Error(`Destination ${to} already exists`);
  const temporary = await mkdtemp(join(tmpdir(), "qflow-snapshot-"));
  let staging: string | undefined;
  try {
    const resources = new FileResourceStore(temporary);
    let input: { document: HyperframesDocument } | { project: HyperframesHtmlProject };
    if (document !== undefined) {
      for (const artifact of document.artifacts) {
        const response = await fetch(new URL(`/__studio/material/${artifact.resource}`, studio));
        if (!response.ok || response.body === null) throw new Error(`Studio material ${artifact.resource}: HTTP ${response.status}`);
        const stream = Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>);
        try { await resources.writeStream(artifact, stream); }
        finally { stream.destroy(); }
      }
      input = { document };
    } else input = { project: await readProject(source, html, resources) };
    const need: Need = { id: "need:qflow-snapshot", capability: renderHyperframesCapabilities.renderFrames,
      returns: renderHyperframesTypes.frames, result: "record:qflow-snapshot", constraints: hyperframesFramesRequest({ ...input, frames }) };
    const { host, profile } = await environment.openHost(options.get("--runtime"), options.get("--workspace"));
    const provider = await selectedProvider(host, need, profile);
    if (!json) io.write(`Capturing ${frames.length} frames through ${providerLine(provider)}\n`);
    const report = json ? io.writeProgress : io.writeProgress ?? io.write;
    const fulfilled = await host.invoke(need, resources, {
      reportProgress: async progress => { report?.(`  · ${progress.phase}\n`); },
      reportDiagnostic: async diagnostic => { report?.(`  · ${diagnostic.message}\n`); },
    });
    if (fulfilled.value.kind !== "inline") throw new Error("The frame list came back by reference");
    verifyHyperframesFrames(fulfilled.value.value);
    const images = fulfilled.value.value;
    if (images.length !== frames.length) throw new Error(`Requested ${frames.length} frames, received ${images.length}`);
    await mkdir(dirname(to), { recursive: true });
    staging = await mkdtemp(join(dirname(to), ".qflow-snapshot-"));
    const files = [];
    for (const [index, image] of images.entries()) {
      const frame = frames[index]!;
      const name = `frame-${String(frame).padStart(9, "0")}.png`;
      const stream = await resources.open(image.resource);
      if (stream === undefined) throw new Error(`Snapshot frame ${frame} is unavailable`);
      await pipeline(stream, createWriteStream(join(staging, name), { flags: "wx" }));
      files.push({ frame, seconds: frame * domain.frameRate.denominator / domain.frameRate.numerator, path: join(to, name) });
    }
    const grids: string[] = [];
    if (columns !== undefined && rows !== undefined) {
      const count = columns * rows;
      for (let offset = 0; offset < files.length; offset += count) {
        const page = [];
        for (const file of files.slice(offset, offset + count)) page.push({ path: join(staging, `frame-${String(file.frame).padStart(9, "0")}.png`),
          label: await snapshotFrameLabel(file.frame, file.seconds, cell) });
        const name = `grid-${String(grids.length + 1).padStart(3, "0")}.jpg`;
        await writeFrameGrid(page, join(staging, name), cell, columns);
        grids.push(join(to, name));
      }
    }
    await rename(staging, to);
    staging = undefined;
    if (json) io.write(`${JSON.stringify({ format: "qflow.video-cli-snapshot@1", source, ...providerView(provider), frames: files, grids }, null, 2)}\n`);
    else io.write(`Captured ${files.length} PNGs${grids.length === 0 ? "" : ` and ${grids.length} grid${grids.length === 1 ? "" : "s"}`}\n  ${to}\n`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
    if (staging !== undefined) await rm(staging, { recursive: true, force: true });
  }
}
