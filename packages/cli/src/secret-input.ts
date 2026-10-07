function removeLastCodePoint(raw: number[]): void {
  if (raw.length === 0) return;
  let start = raw.length - 1;
  while (start > 0 && (raw[start]! & 0xc0) === 0x80) start--;
  raw.splice(start);
}

/** Consume terminal bytes for one hidden UTF-8 secret without echoing them. */
export function acceptSecretBytes(
  raw: number[],
  chunk: Uint8Array,
): "continue" | "done" | "cancelled" {
  for (const byte of chunk) {
    if (byte === 3) return "cancelled";
    if (byte === 10 || byte === 13) return "done";
    if (byte === 8 || byte === 127) removeLastCodePoint(raw);
    else raw.push(byte);
  }
  return "continue";
}
