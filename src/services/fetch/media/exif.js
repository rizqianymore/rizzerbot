function stripChunk(body, fourcc) {
  const parts = [];
  let offset = 0;
  while (offset + 8 <= body.length) {
    const tag = body.subarray(offset, offset + 4).toString("ascii");
    const size = body.readUInt32LE(offset + 4);
    const total = 8 + size + (size % 2);
    if (size < 0 || offset + 8 + size > body.length) {
      parts.push(body.subarray(offset));
      break;
    }
    if (tag !== fourcc) {
      parts.push(body.subarray(offset, offset + total));
    }
    offset += total;
  }
  return Buffer.concat(parts);
}

export function isWebP(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function buildStickerExif(packName, authorName) {
  const json = JSON.stringify({
    "sticker-pack-id": `rizzerbot-${Date.now()}`,
    "sticker-pack-name": packName || "",
    "sticker-pack-publisher": authorName || "",
    emojis: [],
  });
  const exif = Buffer.concat([
    Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16,
      0x00, 0x00, 0x00,
    ]),
    Buffer.from(json, "utf-8"),
  ]);
  exif.writeUIntLE(Buffer.byteLength(json), 14, 4);
  return exif;
}

export function getExifChunk(buffer) {
  if (!isWebP(buffer)) return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const tag = buffer.subarray(offset, offset + 4).toString("ascii");
    const size = buffer.readUInt32LE(offset + 4);
    if (offset + 8 + size > buffer.length) return null;
    if (tag === "EXIF") return buffer.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function injectExif(webpBuffer, exifBuffer) {
  if (!isWebP(webpBuffer)) {
    throw new Error("Buffer bukan file WebP (RIFF....WEBP)");
  }
  if (!Buffer.isBuffer(exifBuffer) || exifBuffer.length === 0) {
    throw new Error("Payload EXIF kosong");
  }
  const body = stripChunk(webpBuffer.subarray(12), "EXIF");

  const header = Buffer.alloc(8);
  header.write("EXIF", 0, "ascii");
  header.writeUInt32LE(exifBuffer.length, 4);
  const pad = exifBuffer.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);

  const out = Buffer.concat([webpBuffer.subarray(0, 12), body, header, exifBuffer, pad]);
  out.writeUInt32LE(out.length - 8, 4);

  let offset = 12;
  while (offset + 9 <= out.length) {
    const tag = out.subarray(offset, offset + 4).toString("ascii");
    const size = out.readUInt32LE(offset + 4);
    if (tag === "VP8X" && size >= 1) {
      out[offset + 8] |= 0x08;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  return out;
}
