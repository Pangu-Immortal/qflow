import { probeMediaToolchain } from "@qflow/media-execution";
import { runtimeConfigObject, runtimeConfigString } from "@qflow/runtime-kit";
import type { RuntimeAdapterFactoryContext, ManagedProgram } from "@qflow/runtime-kit";
import { resolveRuntimeExecutable } from "@qflow/runtime-host-node";

/** A system/custom FFmpeg deployment is external: programs up probes it but never mutates a package manager. */
export function localMediaToolchainProgram(context: RuntimeAdapterFactoryContext): ManagedProgram {
  const config = runtimeConfigObject(context.config, "local media");
  const ffmpegPath = resolveRuntimeExecutable(
    context.dataRoot,
    runtimeConfigString(config.ffmpegPath, "media ffmpegPath") ?? "ffmpeg",
  );
  const ffprobePath = resolveRuntimeExecutable(
    context.dataRoot,
    runtimeConfigString(config.ffprobePath, "media ffprobePath") ?? "ffprobe",
  );
  return {
    id: "media-ffmpeg-toolchain",
    async probe() {
      const state = await probeMediaToolchain({ ffmpegPath, ffprobePath });
      return state.state === "ready"
        ? { state: "ready" as const }
        : { state: state.state, detail: state.detail };
    },
  };
}
