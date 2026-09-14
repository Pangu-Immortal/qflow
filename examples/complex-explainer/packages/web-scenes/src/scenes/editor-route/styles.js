import { stageStyles } from "./stage-styles.js";
import { editorStyles } from "./editor-styles.js";
import { materialsStyles } from "./materials-styles.js";
import { outputStyles } from "./output-styles.js";

export const road_styles = [stageStyles, editorStyles, materialsStyles, outputStyles].join("\n");
