import type { Timeline } from "@qflow/qflow/timeline";
import type { ProducerPackage, ProducerHandlerContext } from "@qflow/qflow/producer";
import type { AdmissionPackage } from "@qflow/qflow/admission";
import { canonicalize } from "@qflow/qflow/protocol";
import type { BlobRef, StoredValue } from "@qflow/qflow/protocol";
import type { SpatialFrame } from "@qflow/qflow/spatial";
import type { Text } from "@qflow/qflow/text";

import { commentStickerProducers, commentStickerTypes } from "./manifest.js";
import { appendProjectedCommentSticker, assertCommentStickerProgram, createCommentStickerSet, createCommentStickerContent, setCommentStickerContentText, finalizeCommentSticker, renderCommentSticker } from "./program.js";
import type {
  CommentStickerHeader,
  CommentStickerContent,
  CommentStickerItemSpec,
  CommentStickerProgram,
  CommentStickerSet,
  CommentStickerStyle,
} from "./types.js";
import type { TemporalWindow } from "@qflow/qflow/temporal";

function inline<T>(value: StoredValue | undefined, label: string): T {
  if (value?.kind !== "inline") throw new Error(`${label} must be inline.`);
  return value.value as unknown as T;
}

const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

function common(inputs: Record<string, { readonly value: StoredValue } | undefined>) {
  return {
    set: inline<CommentStickerSet>(inputs.set?.value, "CommentStickerSet"),
    header: inline<CommentStickerHeader>(inputs.header?.value, "CommentStickerHeader"),
    timeline: inline<Timeline>(inputs.timeline?.value, "Timeline"),
    frame: inline<SpatialFrame>(inputs.frame?.value, "SpatialFrame"),
    style: inline<CommentStickerStyle>(inputs.style?.value, "CommentStickerStyle"),
    spec: inline<CommentStickerItemSpec>(inputs.spec?.value, "CommentStickerItemSpec"),
    content: inline<CommentStickerContent>(inputs.content?.value, "CommentStickerContent"),
    window: inline<TemporalWindow>(inputs.window?.value, "TemporalWindow"),
  };
}

export const commentStickerComponent = {
  producers: [
    {
      producer: commentStickerProducers.createContent,
      handler: ({ inputs }) => ({ outputs: { content: output(createCommentStickerContent(
        inline<Text>(inputs.comment?.value, "Text"),
      )) }, needs: {} }),
    },
    ...([
      [commentStickerProducers.setContentAuthor, "author"],
      [commentStickerProducers.setContentHeader, "header"],
      [commentStickerProducers.setContentMeta, "meta"],
    ] as const).map(([producer, field]) => ({
      producer,
      handler: ({ inputs }: ProducerHandlerContext) => ({ outputs: { content: output(setCommentStickerContentText(
        inline<CommentStickerContent>(inputs.content?.value, "CommentStickerContent"),
        field,
        inline<Text>(inputs[field]?.value, "Text"),
      )) }, needs: {} }),
    })),
    {
      producer: commentStickerProducers.createSet,
      handler: () => ({ outputs: { set: output(createCommentStickerSet()) }, needs: {} }),
    },
    ...([
      [commentStickerProducers.appendItem, false],
      [commentStickerProducers.appendItemAvatar, true],
    ] as const).map(([producer, avatar]) => ({
      producer,
      handler: ({ inputs }: ProducerHandlerContext) => {
        const values = common(inputs);
        return { outputs: { set: output(appendProjectedCommentSticker(
          values.set, values.header, values.timeline, values.frame, values.style, values.spec, values.content, values.window,
          avatar ? inline<BlobRef>(inputs.avatar?.value, "Comment Sticker avatar") : undefined,
        )) }, needs: {} };
      },
    })),
    {
      producer: commentStickerProducers.finalize,
      handler: ({ inputs }) => ({ outputs: { program: output(finalizeCommentSticker(
        inline<CommentStickerSet>(inputs.set?.value, "CommentStickerSet"),
        inline<CommentStickerHeader>(inputs.header?.value, "CommentStickerHeader"),
      )) }, needs: {} }),
    },
    {
      producer: commentStickerProducers.render,
      handler: ({ inputs }) => ({ outputs: { track: output(renderCommentSticker(
        inline<Timeline>(inputs.timeline?.value, "Timeline"),
        inline<CommentStickerProgram>(inputs.program?.value, "CommentStickerProgram"),
      )) }, needs: {} }),
    },
  ],
  validators: [{
    type: commentStickerTypes.program,
    handler: ({ value }) => assertCommentStickerProgram(inline<CommentStickerProgram>(value, "CommentStickerProgram")),
  }],
} satisfies ProducerPackage & AdmissionPackage;
