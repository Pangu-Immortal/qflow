import type { IncomingHttpHeaders } from "node:http";

/** Studio writes belong to the local page serving this Studio session. */
export function allowsStudioMutation(headers: IncomingHttpHeaders): boolean {
  const host = headers.host;
  if (host === undefined) return false;
  let target: URL;
  try { target = new URL(`http://${host}`); } catch { return false; }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || target.host !== host.toLowerCase()) return false;

  const origin = headers.origin;
  if (origin !== undefined) {
    let source: URL;
    try { source = new URL(origin); } catch { return false; }
    if (source.origin !== origin || source.origin !== target.origin) return false;
  }

  const site = headers["sec-fetch-site"];
  return site === undefined || site === "same-origin" || site === "none";
}
