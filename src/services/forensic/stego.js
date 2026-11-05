import sharp from "sharp";

const MAGIC_HEADER = Buffer.from("RZST", "latin1"); // 4 bytes magic

/**
 * Encode secret text into image pixels using LSB (Least Significant Bit).
 * Output format: PNG Buffer (lossless).
 */
export async function encodeLSB(imageBuffer, secretText) {
  if (!secretText || typeof secretText !== "string") {
    throw new Error("Pesan rahasia tidak boleh kosong.");
  }

  const payload = Buffer.from(secretText, "utf8");
  const payloadLen = payload.length;

  // Header: MAGIC (4 bytes) + Length (4 bytes uint32BE) + Payload
  const header = Buffer.alloc(8);
  MAGIC_HEADER.copy(header, 0);
  header.writeUInt32BE(payloadLen, 4);

  const fullData = Buffer.concat([header, payload]);
  const totalBits = fullData.length * 8;

  const { data: rawPixels, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalChannels = info.width * info.height * info.channels;
  // We use RGB channels (skip Alpha to prevent transparency distortion)
  const availableBits = Math.floor((totalChannels / info.channels) * 3);

  if (totalBits > availableBits) {
    throw new Error(
      `Pesan terlalu panjang (${fullData.length} bytes). Kapasitas maksimal foto ini: ${Math.floor(availableBits / 8)} bytes.`
    );
  }

  let bitIdx = 0;
  for (let i = 0; i < rawPixels.length && bitIdx < totalBits; i++) {
    // Lewati channel Alpha (channel ke-4)
    if (info.channels === 4 && (i + 1) % 4 === 0) continue;

    const byteIndex = Math.floor(bitIdx / 8);
    const bitPos = 7 - (bitIdx % 8);
    const bit = (fullData[byteIndex] >> bitPos) & 1;

    // Pasang bit pada LSB
    rawPixels[i] = (rawPixels[i] & 0xfe) | bit;
    bitIdx++;
  }

  return sharp(rawPixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Decode secret text from image pixels using LSB.
 */
export async function decodeLSB(imageBuffer) {
  const { data: rawPixels, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Baca 8 bytes pertama (Header: MAGIC 4 bytes + Length 4 bytes)
  const headerBits = 8 * 8;
  const headerBuf = Buffer.alloc(8);

  let bitIdx = 0;
  let pixelIdx = 0;

  while (pixelIdx < rawPixels.length && bitIdx < headerBits) {
    if (info.channels === 4 && (pixelIdx + 1) % 4 === 0) {
      pixelIdx++;
      continue;
    }

    const bit = rawPixels[pixelIdx] & 1;
    const byteIndex = Math.floor(bitIdx / 8);
    const bitPos = 7 - (bitIdx % 8);

    if (bit) {
      headerBuf[byteIndex] |= 1 << bitPos;
    }

    bitIdx++;
    pixelIdx++;
  }

  if (headerBuf.subarray(0, 4).toString("latin1") !== MAGIC_HEADER.toString("latin1")) {
    return null; // Tidak ada pesan steganografi
  }

  const payloadLen = headerBuf.readUInt32BE(4);
  if (payloadLen <= 0 || payloadLen > 500000) {
    return null;
  }

  const totalBitsNeeded = headerBits + payloadLen * 8;
  const totalChannels = info.width * info.height * info.channels;
  const availableBits = Math.floor((totalChannels / info.channels) * 3);
  if (totalBitsNeeded > availableBits) {
    return null;
  }

  const payloadBuf = Buffer.alloc(payloadLen);

  while (pixelIdx < rawPixels.length && bitIdx < totalBitsNeeded) {
    if (info.channels === 4 && (pixelIdx + 1) % 4 === 0) {
      pixelIdx++;
      continue;
    }

    const bit = rawPixels[pixelIdx] & 1;
    const currentPayloadBit = bitIdx - headerBits;
    const byteIndex = Math.floor(currentPayloadBit / 8);
    const bitPos = 7 - (currentPayloadBit % 8);

    if (bit) {
      payloadBuf[byteIndex] |= 1 << bitPos;
    }

    bitIdx++;
    pixelIdx++;
  }

  return payloadBuf.toString("utf8");
}
