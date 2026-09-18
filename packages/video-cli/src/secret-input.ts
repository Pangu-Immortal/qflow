/** Keep terminal input as bytes until a complete UTF-8 secret can be decoded. */
export function acceptSecretBytes(raw: number[], chunk: Uint8Array): "continue" | "done" | "cancelled" {
  for (const byte of chunk) {
    if (byte === 3) return "cancelled";
    if (byte === 10 || byte === 13) return "done";
    if (byte === 8 || byte === 127) {
      while (raw.length > 0 && (raw.at(-1)! & 0xc0) === 0x80) raw.pop();
      raw.pop();
      continue;
    }
    raw.push(byte);
  }
  return "continue";
}
