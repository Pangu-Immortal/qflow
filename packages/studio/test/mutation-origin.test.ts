import assert from "node:assert/strict";
import fs from "node:fs";
import type { FSWatcher } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ViteDevServer } from "vite";
import { studioFeedbackPlugin } from "../src/feedback-server.js";
import { allowsStudioMutation } from "../src/mutation-origin.js";

test("Studio mutations accept the actual local page and local non-browser clients", () => {
  assert.equal(allowsStudioMutation({ host: "localhost:5173", origin: "http://localhost:5173", "sec-fetch-site": "same-origin" }), true);
  assert.equal(allowsStudioMutation({ host: "127.0.0.1:5173" }), true);
});

test("Studio mutations reject other pages even when they use a loopback hostname", () => {
  assert.equal(allowsStudioMutation({ host: "localhost:5173", origin: "https://example.com", "sec-fetch-site": "cross-site" }), false);
  assert.equal(allowsStudioMutation({ host: "localhost:5173", origin: "http://localhost:4000", "sec-fetch-site": "same-site" }), false);
  assert.equal(allowsStudioMutation({ host: "localhost:5173", "sec-fetch-site": "cross-site" }), false);
  assert.equal(allowsStudioMutation({ host: "example.com:5173", origin: "http://example.com:5173" }), false);
});

test("the feedback write endpoint rejects a foreign page before reading its mutation", async (t) => {
  t.mock.method(fs, "watch", () => ({ close() {} }) as FSWatcher);
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const root = await mkdtemp(join(tmpdir(), "qflow-studio-origin-"));
  let middleware: ((request: IncomingMessage, response: ServerResponse, next: () => void) => void) | undefined;
  const server = createServer((request, response) => {
    assert.ok(middleware);
    middleware(request, response, () => { response.statusCode = 404; response.end(); });
  });
  const plugin = studioFeedbackPlugin(root, join(root, "runs", "main.svrun"));
  (plugin.configureServer as (server: ViteDevServer) => void)({
    httpServer: server,
    ws: { send() {} },
    middlewares: { use(handler: typeof middleware) { middleware = handler; } },
  } as unknown as ViteDevServer);
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/__studio/feedback`;
    const foreign = await fetch(url, { method: "POST", headers: { origin: "https://example.com" }, body: "{}" });
    assert.equal(foreign.status, 403);
    const local = await fetch(url, { method: "POST", headers: { origin: new URL(url).origin }, body: "{}" });
    assert.equal(local.status, 400, "the local request reaches ordinary mutation validation");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
