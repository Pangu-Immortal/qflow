import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { PngFrameParser } from "../src/source-frame-decoder.js";

test("image2pipe parser yields complete PNGs across arbitrary stream chunks", async () => {
  const first = await sharp({ create: { width: 3, height: 2, channels: 4, background: "#ff0000ff" } }).png().toBuffer();
  const second = await sharp({ create: { width: 2, height: 3, channels: 4, background: "#00ff00ff" } }).png().toBuffer();
  const bytes = Buffer.concat([first, second]);
  const parser = new PngFrameParser(Math.max(first.byteLength, second.byteLength));
  const frames: Buffer[] = [];
  for (let offset = 0; offset < bytes.byteLength;) {
    const end = Math.min(bytes.byteLength, offset + (offset % 17) + 1);
    frames.push(...parser.push(bytes.subarray(offset, end)));
    offset = end;
  }
  parser.finish();
  assert.deepEqual(frames, [first, second]);
});

test("image2pipe parser bounds an incomplete or oversized PNG", async () => {
  const png = await sharp({ create: { width: 3, height: 3, channels: 4, background: "#0000ffff" } }).png().toBuffer();
  const parser = new PngFrameParser(png.byteLength - 1);
  assert.throws(() => parser.push(png), /exceeds its frame byte limit/u);
});
