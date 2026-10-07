import { assertAudioTrackIdentity, assertCompositionIdentity, assertVisualTrackIdentity, sealComposition } from "@qflow/qflow/composition";
import type { AudioTrack, Composition, Track, VisualTrack } from "@qflow/qflow/composition";
import { assertCanvas } from "@qflow/qflow/spatial";
import type { Canvas } from "@qflow/qflow/spatial";
import { assertTimelineIdentity } from "@qflow/qflow/timeline";
import type { Timeline } from "@qflow/qflow/timeline";

import type { FilmProgram, FilmTrackSet } from "./types.js";

function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} must not be empty.`);
}

function trackKey(track: Track): string {
  return `${track.kind}\u0000${track.id}`;
}

function filmProgramContent(value: FilmProgram): FilmProgram {
  return {

    id: value.id,
    clearColor: value.clearColor,
  };
}

function filmTrackSetContent(value: FilmTrackSet): FilmTrackSet {
  return {

    tracks: [...value.tracks]
      .map((track) => structuredClone(track))
      .sort((left, right) => trackKey(left).localeCompare(trackKey(right))),
  };
}

export function sealFilmProgram(value: FilmProgram): FilmProgram {
  return filmProgramContent(value);
}

export function assertFilmProgramIdentity(program: FilmProgram): void {
  assertNonEmpty(program.id, "FilmProgram id");
  if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(program.clearColor)) {
    throw new Error("FilmProgram clear color is invalid.");
  }
}

function sealFilmTrackSet(value: FilmTrackSet): FilmTrackSet {
  return filmTrackSetContent(value);
}

export function assertFilmTrackSetIdentity(set: FilmTrackSet): void {
  const ids = new Set<string>();
  for (const track of set.tracks) {
    if (ids.has(track.id)) throw new Error(`FilmTrackSet contains duplicate Track id ${track.id}.`);
    ids.add(track.id);
    if (track.kind === "visual") assertVisualTrackIdentity(track);
    else assertAudioTrackIdentity(track);
  }
}

export function createFilmTrackSet(): FilmTrackSet {
  return sealFilmTrackSet({

    tracks: [],
  });
}

function appendTrack(set: FilmTrackSet, timeline: Timeline, track: Track): FilmTrackSet {
  assertFilmTrackSetIdentity(set);
  assertTimelineIdentity(timeline);
  if (track.kind === "visual") assertVisualTrackIdentity(track, timeline);
  else assertAudioTrackIdentity(track, timeline);
  if (set.tracks.some((existing) => existing.id === track.id)) {
    throw new Error(`FilmTrackSet already contains Track id ${track.id}.`);
  }
  return sealFilmTrackSet({

    tracks: [...set.tracks, track],
  });
}

export function appendFilmVisualTrack(set: FilmTrackSet, timeline: Timeline, track: VisualTrack): FilmTrackSet {
  return appendTrack(set, timeline, track);
}

export function appendFilmAudioTrack(set: FilmTrackSet, timeline: Timeline, track: AudioTrack): FilmTrackSet {
  return appendTrack(set, timeline, track);
}

export function compileFilmComposition(
  program: FilmProgram,
  canvas: Canvas,
  timeline: Timeline,
  set: FilmTrackSet,
): Composition {
  assertFilmProgramIdentity(program);
  assertCanvas(canvas);
  assertTimelineIdentity(timeline);
  assertFilmTrackSetIdentity(set);
  const composition = sealComposition({
    id: program.id,
    canvas: {
      width: canvas.widthPx,
      height: canvas.heightPx,
      clearColor: program.clearColor,
    },
    tracks: set.tracks,
  });
  assertCompositionIdentity(composition, timeline);
  return composition;
}
