import artifact from "../../artifact/src/activation.js";
import captionFine from "../../caption-fine/src/activation.js";
import caption from "../../caption/src/activation.js";
import composition from "../../composition/src/activation.js";
import estimate from "../../estimate/src/activation.js";
import film from "../../film/src/activation.js";
import fontsOpen from "../../fonts-open/src/activation.js";
import generation from "../../generation/src/activation.js";
import renderHyperframes from "../../render-hyperframes/src/activation.js";
import hyperframes from "../../hyperframes/src/activation.js";
import mediaPipeline from "../../media-pipeline/src/activation.js";
import mediaTrack from "../../media-track/src/activation.js";
import media from "../../media/src/activation.js";
import narrative from "../../narrative/src/activation.js";
import programSpace from "../../program-space/src/activation.js";
import text from "../../text/src/activation.js";
import runMarkup from "../../run-markup/src/activation.js";
import script from "../../script/src/activation.js";
import seedance from "../../seedance/src/activation.js";
import speechAlignment from "../../speech-alignment/src/activation.js";
import speechTrack from "../../speech-track/src/activation.js";
import speech from "../../speech/src/activation.js";
import speechEvidence from "../../speech-evidence/src/activation.js";
import semanticTrack from "../../semantic-track/src/activation.js";
import spatial from "../../spatial/src/activation.js";
import standIn from "../../stand-in/src/activation.js";
import temporal from "../../temporal/src/activation.js";
import visualIr from "../../visual-ir/src/activation.js";
import svs from "../../svs/src/activation.js";
import typographyTrack from "../../typography-track/src/activation.js";
import whisperX from "../../whisperx/src/activation.js";
import type { NodePackageContribution } from "@qflow/package-loader-node";

const bind = (specifier: string, contribution: NodePackageContribution) => ({
  specifier,
  contribution,
});

/** Test-only explicit environment; production video CLI starts with no author packages. */
export const videoTestPackages = [
  bind("@qflow/artifact", artifact),
  bind("@qflow/narrative", narrative),
  bind("@qflow/media", media),
  bind("@qflow/program-space", programSpace),
  bind("@qflow/speech", speech),
  bind("@qflow/speech-evidence", speechEvidence),
  bind("@qflow/semantic-track", semanticTrack),
  bind("@qflow/visual-ir", visualIr),
  bind("@qflow/composition", composition),
  bind("@qflow/svs", svs),
  bind("@qflow/script", script),
  bind("@qflow/estimate", estimate),
  bind("@qflow/fonts-open", fontsOpen),
  bind("@qflow/text", text),
  bind("@qflow/generation", generation),
  bind("@qflow/seedance", seedance),
  bind("@qflow/caption", caption),
  bind("@qflow/caption-fine", captionFine),
  bind("@qflow/speech-alignment", speechAlignment),
  bind("@qflow/speech-track", speechTrack),
  bind("@qflow/whisperx", whisperX),
  bind("@qflow/spatial", spatial),
  bind("@qflow/stand-in", standIn),
  bind("@qflow/temporal", temporal),
  bind("@qflow/media-track", mediaTrack),
  bind("@qflow/typography-track", typographyTrack),
  bind("@qflow/film", film),
  bind("@qflow/hyperframes", hyperframes),
  bind("@qflow/media-pipeline", mediaPipeline),
  bind("@qflow/render-hyperframes", renderHyperframes),
  bind("@qflow/run-markup", runMarkup),
] as const;
