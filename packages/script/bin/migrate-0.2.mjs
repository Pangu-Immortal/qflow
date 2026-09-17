#!/usr/bin/env node
/** Explicit, one-time marker migration. Never called by parsing, building, or Studio. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function migrateScriptBody(source) {
  let result = "";
  for (let cursor = 0; cursor < source.length;) {
    if (source[cursor] === "\\") {
      result += source.slice(cursor, cursor + 2);
      cursor += 2;
      continue;
    }
    if (source.startsWith("<!--", cursor)) {
      const close = source.indexOf("-->", cursor + 4);
      if (close < 0) throw new Error("Unclosed Script comment");
      result += source.slice(cursor, close + 3);
      cursor = close + 3;
      continue;
    }
    if (source.startsWith("@{", cursor)) {
      const close = source.indexOf("}", cursor + 2);
      if (close < 0) throw new Error("Unclosed delimited Script marker");
      result += source.slice(cursor, close + 1);
      cursor = close + 1;
      continue;
    }
    const rest = source.slice(cursor);
    const match = /^@\/([a-z][a-z0-9_-]{0,63})(~)/u.exec(rest)
      ?? /^@\/([a-z][a-z0-9_-]{0,63})(?![A-Za-z0-9_-])/u.exec(rest);
    const open = match ? undefined : /^(~)?@([a-z][a-z0-9_-]{0,63})(!)/u.exec(rest)
      ?? /^(~)?@([a-z][a-z0-9_-]{0,63})(?![A-Za-z0-9_-])/u.exec(rest);
    if (match) {
      result += `@{/${match[1]}${match[2] ?? ""}}`;
      cursor += match[0].length;
    } else if (open) {
      result += `@{${open[1] ?? ""}${open[2]}${open[3] ?? ""}}`;
      cursor += open[0].length;
    } else {
      result += source[cursor++];
    }
  }
  return result;
}

/** Change Script raw bodies only; package references and generation prompt tags stay untouched. */
export function migrateSvml(source) {
  let result = "";
  let cursor = 0;
  const token = /<!--[\s\S]*?-->|<(?:[A-Za-z_][\w.-]*:)?script(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/gu;
  for (let match = token.exec(source); match; match = token.exec(source)) {
    if (match[0].startsWith("<!--") || match[0].endsWith("/>")) continue;
    const name = /^<([^\s>]+)/u.exec(match[0])[1];
    const close = `</${name}>`;
    const start = match.index + match[0].length;
    let end = start;
    while (end < source.length) {
      if (source[end] === "\\") { end += 2; continue; }
      if (source.startsWith("<!--", end)) {
        const stop = source.indexOf("-->", end + 4);
        if (stop < 0) throw new Error("Unclosed Script comment");
        end = stop + 3;
        continue;
      }
      if (source.startsWith(close, end)) break;
      end++;
    }
    if (end >= source.length) throw new Error(`Missing ${close}`);
    result += source.slice(cursor, start) + migrateScriptBody(source.slice(start, end)) + close;
    cursor = end + close.length;
    token.lastIndex = cursor;
  }
  return result + source.slice(cursor);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(arg => arg.startsWith("--")));
  const paths = args.filter(arg => !arg.startsWith("--"));
  if (paths.length !== 1 || [...flags].some(flag => !["--write", "--body"].includes(flag))) {
    console.error("Usage: node migrate-0.2.mjs <source.svml> [--body] [--write]\nDefault: print migrated SVML. --body: input is a raw Script body. --write: replace the named file.");
    process.exitCode = 2;
  } else {
    const source = await readFile(paths[0], "utf8");
    const migrated = flags.has("--body") ? migrateScriptBody(source) : migrateSvml(source);
    if (flags.has("--write")) await writeFile(paths[0], migrated);
    else process.stdout.write(migrated);
  }
}
