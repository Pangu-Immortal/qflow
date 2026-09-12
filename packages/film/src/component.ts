import type { Timeline } from "@qflow/timeline";
import type { ComponentPackage } from "@qflow/component-kit";
import type { CanvasSpace } from "@qflow/spatial";
import type { AudioTrack, VisualTrack } from "@qflow/composition";
import type { StoredValue } from "@qflow/protocol";
import { canonicalize } from "@qflow/protocol";

import { filmProducers } from "./manifest.js";
import { appendFilmAudioTrack, appendFilmVisualTrack, compileFilmComposition, createFilmTrackSet } from "./program.js";
import type { FilmProgram, FilmTrackSet } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as unknown as T;
}

export const filmComponent = {
  producers: [
    {
      producer: filmProducers.createTrackSet,
      handler: () => ({
        outputs: { set: { kind: "inline", value: canonicalize(createFilmTrackSet()) } },
        needs: {},
      }),
    },
    {
      producer: filmProducers.appendVisualTrack,
      handler: ({ inputs }) => ({
        outputs: { set: { kind: "inline", value: canonicalize(appendFilmVisualTrack(
          inline<FilmTrackSet>(inputs.set?.value, "FilmTrackSet"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<VisualTrack>(inputs.track?.value, "VisualTrack"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: filmProducers.appendAudioTrack,
      handler: ({ inputs }) => ({
        outputs: { set: { kind: "inline", value: canonicalize(appendFilmAudioTrack(
          inline<FilmTrackSet>(inputs.set?.value, "FilmTrackSet"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<AudioTrack>(inputs.track?.value, "AudioTrack"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: filmProducers.compileComposition,
      handler: ({ inputs }) => ({
        outputs: { composition: { kind: "inline", value: canonicalize(compileFilmComposition(
          inline<FilmProgram>(inputs.program?.value, "FilmProgram"),
          inline<CanvasSpace>(inputs.canvas?.value, "CanvasSpace"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<FilmTrackSet>(inputs.set?.value, "FilmTrackSet"),
        )) } },
        needs: {},
      }),
    },
  ],
} satisfies ComponentPackage;
