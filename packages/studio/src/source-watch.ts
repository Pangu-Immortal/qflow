import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

/** Local Studio watches canonical filesystem Sources, not arbitrary Source identities. */
export function createSourceWatch(changed: () => void, warn: (message: string) => void) {
  let closed = false;
  let files = new Set<string>();
  const directories = new Map<string, { watcher?: FSWatcher }>();

  return {
    replace(sources: readonly string[]): void {
      if (closed) return;
      // The filesystem Workspace uses absolute paths as canonical ids. Do not turn
      // virtual ids into cwd-relative filenames, or mistake a deleted file for a virtual id.
      files = new Set(sources.filter(isAbsolute).map(path => resolve(path)));
      const selected = new Set([...files].map(path => dirname(path)));
      for (const [directory, entry] of directories) {
        if (selected.has(directory)) continue;
        directories.delete(directory);
        entry.watcher?.close();
      }
      for (const directory of selected) {
        if (directories.has(directory)) continue;
        const entry: { watcher?: FSWatcher } = {};
        directories.set(directory, entry);
        const failed = (error: unknown): void => {
          if (directories.get(directory) !== entry) return;
          entry.watcher?.close();
          delete entry.watcher;
          warn(`Studio cannot watch Source directory ${directory}: ${error instanceof Error ? error.message : String(error)}. External Source edits in this directory may not update the preview. Browser refresh does not recompile Sources; restart Studio to restore watching.`);
        };
        try {
          entry.watcher = watch(directory, (_event, filename) => {
            if (directories.get(directory) !== entry || entry.watcher === undefined) return;
            if (filename === null || files.has(resolve(directory, filename.toString()))) changed();
          });
          entry.watcher.on("error", failed);
        } catch (error) {
          failed(error);
        }
      }
    },
    close(): void {
      closed = true;
      files.clear();
      for (const [directory, entry] of directories) {
        directories.delete(directory);
        entry.watcher?.close();
      }
    },
  };
}
