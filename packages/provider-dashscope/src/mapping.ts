import type { ModuleRef } from "@qflow/qflow/protocol";
import type { GenerationWireMapping } from "@qflow/generation";

const WAN: ModuleRef = { name: "@qflow/wan", version: "1" };

/**
 * DashScope's Wan video wire shape: `input.media` carries typed reference items and `parameters`
 * carries the render knobs. The mapping names the flat fields; `routes.ts` folds the two media
 * arrays into the typed `media` array the service expects.
 */
const wanVideo: GenerationWireMapping = {
  capability: { module: WAN, name: "wan-3.0-video" },
  result: "video",
  routes: [{ model: "wan3.0-video" }],
  fields: {
    prompt: { as: "value", field: "prompt" },
    images: { as: "urlArray", field: "reference_image" },
    audios: { as: "urlArray", field: "reference_audio" },
    resolution: { as: "value", field: "resolution" },
    ratio: { as: "value", field: "ratio" },
    duration: { as: "value", field: "duration" },
    audio: { as: "value", field: "audio" },
    watermark: { as: "value", field: "watermark", whenAbsent: false },
    seed: { as: "value", field: "seed" },
  },
  constants: { prompt_extend: true },
};

export const dashScopeMappings: readonly GenerationWireMapping[] = [wanVideo];
