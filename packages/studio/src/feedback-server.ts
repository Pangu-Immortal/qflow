import { watch } from "node:fs";
import { relative } from "node:path";
import type { Plugin } from "vite";
import { createFeedbackStore, FeedbackConflict } from "./feedback-store.js";
import { readFeedbackMutation } from "./feedback.js";
import type { FeedbackDocument, FeedbackView } from "./feedback.js";

/** Review storage is separate from compilation, Results and Agent delivery. */
export function studioFeedbackPlugin(workspaceRoot: string, runPath: string): Plugin {
  const store = createFeedbackStore(workspaceRoot);
  const run = relative(workspaceRoot, runPath).replaceAll("\\", "/");
  const view = (document: FeedbackDocument): FeedbackView => ({
    file: "FEEDBACK.json", run, comments: document.comments.filter((comment) => comment.run === run),
  });
  return {
    name: "qflow-studio-feedback",
    configureServer(server) {
      const watcher = watch(workspaceRoot, (_event, filename) => {
        if (filename === null || filename.toString() === "FEEDBACK.json") {
          server.ws.send({ type: "custom", event: "studio:feedback-changed", data: {} });
        }
      });
      server.httpServer?.once("close", () => watcher.close());
      server.middlewares.use((request, response, next) => {
        if (new URL(request.url ?? "/", "http://studio.qflow.local").pathname !== "/__studio/feedback") return next();
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        void (async () => {
          try {
            if (request.method === "GET") {
              response.end(JSON.stringify(view(await store.read())));
              return;
            }
            if (request.method !== "POST") { response.statusCode = 405; response.end(); return; }
            const chunks: Buffer[] = [];
            for await (const chunk of request) chunks.push(Buffer.from(chunk));
            const mutation = readFeedbackMutation(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            const comment = mutation.type === "delete" ? mutation.before : mutation.comment;
            if (comment.run !== run) throw new Error("The comment belongs to another Run.");
            const result = view(await store.mutate(mutation));
            response.end(JSON.stringify(result));
            server.ws.send({ type: "custom", event: "studio:feedback-changed", data: {} });
          } catch (error) {
            response.statusCode = error instanceof FeedbackConflict ? 409 : 400;
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
        })();
      });
    },
  };
}
