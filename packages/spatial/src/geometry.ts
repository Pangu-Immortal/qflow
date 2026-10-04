
import type {
  AnchoredFrameProgram,
  AspectFrameProgram,
  Canvas,
  ContentFit,
  FrameEdgesProgram,
  IntrinsicExtent,
  SpatialAnchor,
  SpatialFrame,
  SpatialLength,
  SpatialMap2D,
  SpatialPath,
  SpatialPoint,
} from "./types.js";

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function positive(value: number, label: string): void {
  finite(value, label);
  if (value <= 0) throw new Error(`${label} must be positive.`);
}

export function assertCanvas(value: Canvas): void {
  if (!Number.isSafeInteger(value.widthPx) || value.widthPx <= 0
    || !Number.isSafeInteger(value.heightPx) || value.heightPx <= 0) {
    throw new Error("Canvas is invalid.");
  }
}

export function assertSpatialPoint(value: SpatialPoint): void {
  finite(value.xPx, "SpatialPoint.xPx");
  finite(value.yPx, "SpatialPoint.yPx");
}

export function assertSpatialFrame(value: SpatialFrame): void {
  finite(value.xPx, "SpatialFrame.xPx");
  finite(value.yPx, "SpatialFrame.yPx");
  positive(value.widthPx, "SpatialFrame.widthPx");
  positive(value.heightPx, "SpatialFrame.heightPx");
}

export function assertIntrinsicExtent(value: IntrinsicExtent): void {
  positive(value.widthPx, "IntrinsicExtent.widthPx");
  positive(value.heightPx, "IntrinsicExtent.heightPx");
}

function assertNormalizedPoint(value: { readonly x: number; readonly y: number }, label: string): void {
  finite(value.x, `${label}.x`);
  finite(value.y, `${label}.y`);
  if (value.x < 0 || value.x > 1 || value.y < 0 || value.y > 1) {
    throw new Error(`${label} must lie inside [0, 1].`);
  }
}

export function assertContentFit(value: ContentFit): void {
  if (!["contain", "cover", "fit-width", "fit-height", "native", "scale-down", "stretch"].includes(value.sizing)) {
    throw new Error("ContentFit.sizing is invalid.");
  }
  assertNormalizedPoint(value.framePoint, "ContentFit.framePoint");
  assertNormalizedPoint(value.contentPoint, "ContentFit.contentPoint");
  finite(value.offsetPx.x, "ContentFit.offsetPx.x");
  finite(value.offsetPx.y, "ContentFit.offsetPx.y");
  if (value.constraint !== "bounded" && value.constraint !== "free") throw new Error("ContentFit.constraint is invalid.");
}

export function assertSpatialMap2D(value: SpatialMap2D): void {
  finite(value.xx, "SpatialMap2D.xx");
  finite(value.xy, "SpatialMap2D.xy");
  finite(value.yx, "SpatialMap2D.yx");
  finite(value.yy, "SpatialMap2D.yy");
  finite(value.tx, "SpatialMap2D.tx");
  finite(value.ty, "SpatialMap2D.ty");
}

function commandNumbers(command: SpatialPath["commands"][number]): readonly number[] {
  switch (command.kind) {
    case "move":
    case "line": return [command.xPx, command.yPx];
    case "quadratic": return [command.controlX, command.controlY, command.xPx, command.yPx];
    case "cubic": return [command.control1X, command.control1Y, command.control2X, command.control2Y, command.xPx, command.yPx];
    case "close": return [];
  }
}

export function assertSpatialPath(value: SpatialPath): void {
  if (value.commands.length < 2 || value.commands[0]?.kind !== "move") {
    throw new Error("SpatialPath must begin with move and contain drawable commands.");
  }
  let open = true;
  let drawable = false;
  for (const [index, command] of value.commands.entries()) {
    for (const coordinate of commandNumbers(command)) finite(coordinate, `SpatialPath command ${index}`);
    if (command.kind === "move") {
      open = true;
    } else if (command.kind === "close") {
      if (!open) throw new Error("SpatialPath cannot close an already closed subpath.");
      open = false;
    } else {
      if (!open) throw new Error("SpatialPath requires move after a closed subpath.");
      drawable = true;
    }
  }
  if (!drawable) throw new Error("SpatialPath contains no drawable segment.");
}

function length(value: SpatialLength, dimension: number, label: string): number {
  finite(value.value, label);
  if (value.unit === "px") return value.value;
  if (value.unit === "percent") return dimension * value.value / 100;
  throw new Error(`${label} uses an unsupported unit.`);
}

function anchorPoint(anchor: SpatialAnchor): { readonly x: number; readonly y: number } {
  const [vertical, horizontal] = anchor === "center" ? ["middle", "center"] : anchor.split("-");
  const x = horizontal === "left" ? 0 : horizontal === "center" ? 0.5 : horizontal === "right" ? 1 : undefined;
  const y = vertical === "top" ? 0 : vertical === "middle" ? 0.5 : vertical === "bottom" ? 1 : undefined;
  if (x === undefined || y === undefined) throw new Error(`Spatial anchor ${anchor} is invalid.`);
  return { x, y };
}

function sealFrame(value: SpatialFrame): SpatialFrame {
  const frame = { ...value };
  assertSpatialFrame(frame);
  return frame;
}

export function canvasFrame(canvas: Canvas): SpatialFrame {
  assertCanvas(canvas);
  return sealFrame({ xPx: 0, yPx: 0, widthPx: canvas.widthPx, heightPx: canvas.heightPx });
}

export function frameFromEdges(parent: SpatialFrame, program: FrameEdgesProgram): SpatialFrame {
  assertSpatialFrame(parent);
  const left = parent.xPx + length(program.left, parent.widthPx, "Frame left");
  const right = parent.xPx + length(program.right, parent.widthPx, "Frame right");
  const top = parent.yPx + length(program.top, parent.heightPx, "Frame top");
  const bottom = parent.yPx + length(program.bottom, parent.heightPx, "Frame bottom");
  return sealFrame({ xPx: left, yPx: top, widthPx: right - left, heightPx: bottom - top });
}

export function anchoredFrame(parent: SpatialFrame, program: AnchoredFrameProgram): SpatialFrame {
  assertSpatialFrame(parent);
  const widthPx = length(program.width, parent.widthPx, "AnchoredFrame width");
  const heightPx = length(program.height, parent.heightPx, "AnchoredFrame height");
  positive(widthPx, "AnchoredFrame width");
  positive(heightPx, "AnchoredFrame height");
  const targetX = parent.xPx + length(program.x, parent.widthPx, "AnchoredFrame x");
  const targetY = parent.yPx + length(program.y, parent.heightPx, "AnchoredFrame y");
  finite(program.offsetPx.x, "AnchoredFrame offset x");
  finite(program.offsetPx.y, "AnchoredFrame offset y");
  const anchor = anchorPoint(program.anchor);
  return sealFrame({
    xPx: targetX - widthPx * anchor.x + program.offsetPx.x,
    yPx: targetY - heightPx * anchor.y + program.offsetPx.y,
    widthPx,
    heightPx,
  });
}

export function aspectFrame(parent: SpatialFrame, extent: IntrinsicExtent, program: AspectFrameProgram): SpatialFrame {
  assertSpatialFrame(parent);
  assertIntrinsicExtent(extent);
  const primary = length(program.size, program.primary === "width" ? parent.widthPx : parent.heightPx, "AspectFrame size");
  positive(primary, "AspectFrame size");
  const widthPx = program.primary === "width" ? primary : primary * extent.widthPx / extent.heightPx;
  const heightPx = program.primary === "height" ? primary : primary * extent.heightPx / extent.widthPx;
  return anchoredFrame(parent, {
    x: program.x,
    y: program.y,
    width: { unit: "px", value: widthPx },
    height: { unit: "px", value: heightPx },
    anchor: program.anchor,
    offsetPx: program.offsetPx,
  });
}

function boundedCoordinate(position: number, contentSize: number, frameStart: number, frameSize: number): number {
  const first = frameStart;
  const second = frameStart + frameSize - contentSize;
  const low = Math.min(first, second);
  const high = Math.max(first, second);
  return Math.min(high, Math.max(low, position));
}

/** Resolve a source-local pixel plane into the program picture plane. */
export function resolveContentFit(frame: SpatialFrame, extent: IntrinsicExtent, fit: ContentFit): SpatialMap2D {
  assertSpatialFrame(frame);
  assertIntrinsicExtent(extent);
  assertContentFit(fit);
  const containScale = Math.min(frame.widthPx / extent.widthPx, frame.heightPx / extent.heightPx);
  const scale = fit.sizing === "contain" ? containScale
    : fit.sizing === "cover" ? Math.max(frame.widthPx / extent.widthPx, frame.heightPx / extent.heightPx)
    : fit.sizing === "fit-width" ? frame.widthPx / extent.widthPx
    : fit.sizing === "fit-height" ? frame.heightPx / extent.heightPx
    : fit.sizing === "native" ? 1
    : fit.sizing === "scale-down" ? Math.min(1, containScale)
    : undefined;
  const widthPx = fit.sizing === "stretch" ? frame.widthPx : extent.widthPx * (scale ?? 1);
  const heightPx = fit.sizing === "stretch" ? frame.heightPx : extent.heightPx * (scale ?? 1);
  let xPx = frame.xPx + frame.widthPx * fit.framePoint.x - widthPx * fit.contentPoint.x + fit.offsetPx.x;
  let yPx = frame.yPx + frame.heightPx * fit.framePoint.y - heightPx * fit.contentPoint.y + fit.offsetPx.y;
  if (fit.constraint === "bounded") {
    xPx = boundedCoordinate(xPx, widthPx, frame.xPx, frame.widthPx);
    yPx = boundedCoordinate(yPx, heightPx, frame.yPx, frame.heightPx);
  }
  const result: SpatialMap2D = {
    xx: widthPx / extent.widthPx,
    xy: 0,
    yx: 0,
    yy: heightPx / extent.heightPx,
    tx: xPx,
    ty: yPx,
  };
  assertSpatialMap2D(result);
  return result;
}

export function mapSpatialPoint(point: SpatialPoint, mapping: SpatialMap2D): SpatialPoint {
  assertSpatialPoint(point);
  assertSpatialMap2D(mapping);
  return sealSpatialPoint({
    xPx: mapping.xx * point.xPx + mapping.xy * point.yPx + mapping.tx,
    yPx: mapping.yx * point.xPx + mapping.yy * point.yPx + mapping.ty,
  });
}

/** Compose mappings in application order: `first`, then `second`. */
export function composeSpatialMaps(first: SpatialMap2D, second: SpatialMap2D): SpatialMap2D {
  assertSpatialMap2D(first);
  assertSpatialMap2D(second);
  return sealSpatialMap2D({
    xx: second.xx * first.xx + second.xy * first.yx,
    xy: second.xx * first.xy + second.xy * first.yy,
    yx: second.yx * first.xx + second.yy * first.yx,
    yy: second.yx * first.xy + second.yy * first.yy,
    tx: second.xx * first.tx + second.xy * first.ty + second.tx,
    ty: second.yx * first.tx + second.yy * first.ty + second.ty,
  });
}

function mapPathCommand(command: SpatialPath["commands"][number], mapping: SpatialMap2D): SpatialPath["commands"][number] {
  const point = (xPx: number, yPx: number) => mapSpatialPoint({ xPx, yPx }, mapping);
  if (command.kind === "close") return command;
  if (command.kind === "move" || command.kind === "line") {
    const mapped = point(command.xPx, command.yPx);
    return { kind: command.kind, ...mapped };
  }
  if (command.kind === "quadratic") {
    const control = point(command.controlX, command.controlY);
    const end = point(command.xPx, command.yPx);
    return { kind: "quadratic", controlX: control.xPx, controlY: control.yPx, ...end };
  }
  const control1 = point(command.control1X, command.control1Y);
  const control2 = point(command.control2X, command.control2Y);
  const end = point(command.xPx, command.yPx);
  return {
    kind: "cubic",
    control1X: control1.xPx, control1Y: control1.yPx,
    control2X: control2.xPx, control2Y: control2.yPx,
    ...end,
  };
}

export function mapSpatialPath(path: SpatialPath, mapping: SpatialMap2D): SpatialPath {
  assertSpatialPath(path);
  assertSpatialMap2D(mapping);
  return sealSpatialPath({ commands: path.commands.map((command) => mapPathCommand(command, mapping)) });
}

/** Preserve an exact transformed rectangle as a closed Path. */
export function mapSpatialFramePath(frame: SpatialFrame, mapping: SpatialMap2D): SpatialPath {
  assertSpatialFrame(frame);
  return mapSpatialPath({ commands: [
    { kind: "move", xPx: frame.xPx, yPx: frame.yPx },
    { kind: "line", xPx: frame.xPx + frame.widthPx, yPx: frame.yPx },
    { kind: "line", xPx: frame.xPx + frame.widthPx, yPx: frame.yPx + frame.heightPx },
    { kind: "line", xPx: frame.xPx, yPx: frame.yPx + frame.heightPx },
    { kind: "close" },
  ] }, mapping);
}

/** Return the axis-aligned bounds of a transformed Frame; rotation is not discarded silently. */
export function mapSpatialFrameBounds(frame: SpatialFrame, mapping: SpatialMap2D): SpatialFrame {
  const points = [
    mapSpatialPoint({ xPx: frame.xPx, yPx: frame.yPx }, mapping),
    mapSpatialPoint({ xPx: frame.xPx + frame.widthPx, yPx: frame.yPx }, mapping),
    mapSpatialPoint({ xPx: frame.xPx + frame.widthPx, yPx: frame.yPx + frame.heightPx }, mapping),
    mapSpatialPoint({ xPx: frame.xPx, yPx: frame.yPx + frame.heightPx }, mapping),
  ];
  const x = points.map((point) => point.xPx);
  const y = points.map((point) => point.yPx);
  const left = Math.min(...x);
  const top = Math.min(...y);
  return sealSpatialFrame({
    xPx: left,
    yPx: top,
    widthPx: Math.max(...x) - left,
    heightPx: Math.max(...y) - top,
  });
}

export function mapIntrinsicExtentBounds(extent: IntrinsicExtent, mapping: SpatialMap2D): SpatialFrame {
  assertIntrinsicExtent(extent);
  return mapSpatialFrameBounds({ xPx: 0, yPx: 0, widthPx: extent.widthPx, heightPx: extent.heightPx }, mapping);
}

export function sealCanvas(value: Canvas): Canvas { assertCanvas(value); return structuredClone(value); }
export function sealSpatialPoint(value: SpatialPoint): SpatialPoint { assertSpatialPoint(value); return structuredClone(value); }
export function sealSpatialFrame(value: SpatialFrame): SpatialFrame { assertSpatialFrame(value); return structuredClone(value); }
export function sealSpatialPath(value: SpatialPath): SpatialPath { assertSpatialPath(value); return structuredClone(value); }
export function sealIntrinsicExtent(value: IntrinsicExtent): IntrinsicExtent { assertIntrinsicExtent(value); return structuredClone(value); }
export function sealSpatialMap2D(value: SpatialMap2D): SpatialMap2D { assertSpatialMap2D(value); return structuredClone(value); }
export function sealContentFit(value: ContentFit): ContentFit { assertContentFit(value); return structuredClone(value); }
