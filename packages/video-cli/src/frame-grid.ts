import sharp from "sharp";

/** Arrange already captured evidence. Decoding and time selection belong to the caller. */
export async function writeFrameGrid(
  frames: readonly { readonly path: string; readonly label: Buffer }[],
  target: string, cellWidth: number, columns: number,
): Promise<void> {
  if (frames.length === 0) throw new Error("A frame grid needs at least one image");
  const cells = [];
  for (const frame of frames) {
    const picture = await sharp(frame.path).resize({ width: cellWidth }).png().toBuffer({ resolveWithObject: true });
    const labelHeight = (await sharp(frame.label).metadata()).height!;
    cells.push({ picture: picture.data, height: picture.info.height, label: frame.label, labelHeight });
  }
  const pictureHeight = Math.max(...cells.map(cell => cell.height));
  const rowHeight = pictureHeight + Math.max(...cells.map(cell => cell.labelHeight));
  const rows = Math.ceil(cells.length / columns);
  await sharp({ create: {
    width: columns * (cellWidth + 8) + 8, height: rows * (rowHeight + 8) + 8,
    channels: 3, background: "#0c0c0c",
  } }).composite(cells.flatMap((cell, index) => {
    const left = 8 + index % columns * (cellWidth + 8);
    const top = 8 + Math.floor(index / columns) * (rowHeight + 8);
    return [{ input: cell.picture, left, top }, { input: cell.label, left, top: top + pictureHeight }];
  })).toFile(target);
}

export async function snapshotFrameLabel(frame: number, seconds: number, width: number): Promise<Buffer> {
  const text = await sharp({ text: { text: `<span foreground="#f5f5f5">Frame ${frame} · ${seconds.toFixed(6)} s</span>`,
    font: `sans ${Math.max(12, Math.round(width / 28))}`, width: width - 16, rgba: true,
  } }).png().toBuffer({ resolveWithObject: true });
  return sharp({ create: { width, height: text.info.height + 16, channels: 3, background: "#0c0c0c" } })
    .composite([{ input: text.data, left: 8, top: 8 }]).png().toBuffer();
}
