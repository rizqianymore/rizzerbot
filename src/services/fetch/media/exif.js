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

function parseWebpCanvasSize(buf) {
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const tag = buf.subarray(offset, offset + 4).toString("ascii");
    const size = buf.readUInt32LE(offset + 4);
    if (tag === "VP8X" && size >= 10) {
      const w = 1 + buf.readUIntLE(offset + 8 + 4, 3);
      const h = 1 + buf.readUIntLE(offset + 8 + 7, 3);
      const flags = buf[offset + 8];
      return { width: w, height: h, flags };
    }
    if (tag === "VP8 " && size >= 10) {
      const vp8 = buf.subarray(offset + 8);
      if (vp8[3] === 0x9d && vp8[4] === 0x01 && vp8[5] === 0x2a) {
        return { width: vp8.readUInt16LE(6) & 0x3fff, height: vp8.readUInt16LE(8) & 0x3fff, flags: 0 };
      }
    }
    if (tag === "VP8L" && size >= 5) {
      const vp8l = buf.subarray(offset + 8);
      if (vp8l[0] === 0x2f) {
        const val = vp8l.readUInt32LE(1);
        const hasAlpha = Boolean((val >> 28) & 1);
        return { width: (val & 0x3fff) + 1, height: ((val >> 14) & 0x3fff) + 1, flags: hasAlpha ? 0x10 : 0 };
      }
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

function buildVp8xChunk(width, height, flags = 0) {
  const buf = Buffer.alloc(18);
  buf.write("VP8X", 0, "ascii");
  buf.writeUInt32LE(10, 4);
  buf[8] = flags;
  buf.writeUIntLE(Math.max(0, (width || 512) - 1), 12, 3);
  buf.writeUIntLE(Math.max(0, (height || 512) - 1), 15, 3);
  return buf;
}

export function injectExif(webpBuffer, exifBuffer) {
  if (!isWebP(webpBuffer)) {
    throw new Error("Buffer bukan file WebP (RIFF....WEBP)");
  }
  if (!Buffer.isBuffer(exifBuffer) || exifBuffer.length === 0) {
    throw new Error("Payload EXIF kosong");
  }
  let body = stripChunk(webpBuffer.subarray(12), "EXIF");

  const header = Buffer.alloc(8);
  header.write("EXIF", 0, "ascii");
  header.writeUInt32LE(exifBuffer.length, 4);
  const pad = exifBuffer.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);

  const hasVp8x = body.length >= 8 && body.subarray(0, 4).toString("ascii") === "VP8X";
  if (!hasVp8x) {
    const meta = parseWebpCanvasSize(webpBuffer) || { width: 512, height: 512, flags: 0 };
    const vp8xChunk = buildVp8xChunk(meta.width, meta.height, (meta.flags || 0) | 0x08);
    body = Buffer.concat([vp8xChunk, body]);
  } else {
    body[8] |= 0x08;
  }

  const out = Buffer.concat([webpBuffer.subarray(0, 12), body, header, exifBuffer, pad]);
  out.writeUInt32LE(out.length - 8, 4);
  return out;
}
