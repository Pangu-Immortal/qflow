import artifact from "../../blob/src/activation.js";
import captionFine from "../../caption-fine/src/activation.js";
import caption from "../../caption/src/activation.js";
import composition from "../../composition/src/activation.js";
import film from "../../film/src/activation.js";
import fontsource from "../../fontsource/src/activation.js";
import generation from "../../generation/src/activation.js";
import renderHTML from "../../html-video/src/activation.js";
import htmlProgram from "../../html-program/src/activation.js";
import mediaOperations from "../../media-operations/src/activation.js";
import mediaTrack from "../../visual-track/src/activation.js";
import media from "../../media/src/activation.js";
import narrative from "../../narrative/src/activation.js";
import narrativeCaption from "../../narrative-caption/src/activation.js";
import narrativeTemporal from "../../narrative-temporal/src/activation.js";
import text from "../../text/src/activation.js";
import runMarkup from "../../markup/src/run/activation.js";
import script from "../../script/src/activation.js";
import seedance from "../../seedance/src/activation.js";
import speechAlignment from "../../narrative-speech-alignment/src/activation.js";
import timelineAuthor from "../../timeline-author/src/activation.js";
import speechEvidence from "../../speech-evidence/src/activation.js";
import timeline from "../../timeline/src/activation.js";
import spatial from "../../spatial/src/activation.js";
import temporal from "../../temporal/src/activation.js";
import svs from "../../recipe/src/activation.js";
import textFine from "../../text-fine/src/activation.js";
import whisperX from "../../whisperx/src/activation.js";
import type { PackageContribution } from "@qflow/loader";

const bind = (specifier: string, contribution: PackageContribution) => ({
  specifier,
  contribution,
});

/** Test-only explicit environment; the production Video application starts with no author packages. */
export const videoTestPackages = [
  bind("@qflow/blob", artifact),
  bind("@qflow/narrative", narrative),
  bind("@qflow/narrative-caption", narrativeCaption),
  bind("@qflow/narrative-temporal", narrativeTemporal),
  bind("@qflow/media", media),
  bind("@qflow/speech-evidence", speechEvidence),
  bind("@qflow/timeline", timeline),
  bind("@qflow/composition", composition),
  bind("@qflow/recipe", svs),
  bind("@qflow/script", script),
  bind("@qflow/fontsource", fontsource),
  bind("@qflow/text", text),
  bind("@qflow/generation", generation),
  bind("@qflow/seedance", seedance),
  bind("@qflow/caption", caption),
  bind("@qflow/caption-fine", captionFine),
  bind("@qflow/narrative-speech-alignment", speechAlignment),
  bind("@qflow/timeline-author", timelineAuthor),
  bind("@qflow/whisperx", whisperX),
  bind("@qflow/spatial", spatial),
  bind("@qflow/temporal", temporal),
  bind("@qflow/visual-track", mediaTrack),
  bind("@qflow/text-fine", textFine),
  bind("@qflow/film", film),
  bind("@qflow/html-program", htmlProgram),
  bind("@qflow/media-operations", mediaOperations),
  bind("@qflow/html-video", renderHTML),
  bind("@qflow/markup", runMarkup),
] as const;
