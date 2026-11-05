const EXIF_TAG_NAMES = {
  0x010f: "Make",
  0x0110: "Model",
  0x0112: "Orientation",
  0x0131: "Software",
  0x0132: "DateTime",
  0x013b: "Artist",
  0x8298: "Copyright",
  0x8769: "ExifIFDPointer",
  0x8825: "GPSInfoIFDPointer",
  // Exif SubIFD
  0x829a: "ExposureTime",
  0x829d: "FNumber",
  0x8827: "ISOSpeedRatings",
  0x9003: "DateTimeOriginal",
  0x9004: "DateTimeDigitized",
  0x920a: "FocalLength",
  0xa434: "LensModel",
  // GPS Tags
  0x0001: "GPSLatitudeRef",
  0x0002: "GPSLatitude",
  0x0003: "GPSLongitudeRef",
  0x0004: "GPSLongitude",
  0x0005: "GPSAltitudeRef",
  0x0006: "GPSAltitude",
};

function readTiffData(buf, tiffOffset, isLE, type, count, valOrOff) {
  const readU32 = (off) => (isLE ? buf.readUInt32LE(off) : buf.readUInt32BE(off));

  // Type 2: ASCII string
  if (type === 2) {
    const dataOffset = count > 4 ? tiffOffset + valOrOff : null;
    if (dataOffset !== null) {
      if (dataOffset + count <= buf.length) {
        return buf.toString("utf8", dataOffset, dataOffset + count).replace(/\0+$/, "").trim();
      }
    } else {
      // 4 bytes in valOrOff
      const slice = Buffer.alloc(4);
      if (isLE) slice.writeUInt32LE(valOrOff);
      else slice.writeUInt32BE(valOrOff);
      return slice.toString("utf8", 0, count).replace(/\0+$/, "").trim();
    }
  }

  // Type 3: SHORT (uint16)
  if (type === 3) {
    return isLE ? valOrOff & 0xffff : (valOrOff >> 16) & 0xffff;
  }

  // Type 4: LONG (uint32)
  if (type === 4) {
    return valOrOff;
  }

  // Type 5: RATIONAL (two uint32: numerator / denominator)
  if (type === 5) {
    const dataOffset = tiffOffset + valOrOff;
    if (dataOffset + 8 * count <= buf.length) {
      if (count === 1) {
        const num = readU32(dataOffset);
        const den = readU32(dataOffset + 4);
        return den !== 0 ? num / den : num;
      }
      const vals = [];
      for (let i = 0; i < count; i++) {
        const num = readU32(dataOffset + i * 8);
        const den = readU32(dataOffset + i * 8 + 4);
        vals.push(den !== 0 ? num / den : num);
      }
      return vals;
    }
  }

  return valOrOff;
}

function parseIFD(buf, tiffOffset, ifdOffset, isLE, targetObj = {}) {
  const readU16 = (off) => (isLE ? buf.readUInt16LE(off) : buf.readUInt16BE(off));
  const readU32 = (off) => (isLE ? buf.readUInt32LE(off) : buf.readUInt32BE(off));

  if (ifdOffset + 2 > buf.length) return targetObj;
  const numEntries = readU16(ifdOffset);

  for (let i = 0; i < numEntries; i++) {
    const entryOff = ifdOffset + 2 + i * 12;
    if (entryOff + 12 > buf.length) break;

    const tag = readU16(entryOff);
    const type = readU16(entryOff + 2);
    const count = readU32(entryOff + 4);
    const valOrOff = readU32(entryOff + 8);

    const tagName = EXIF_TAG_NAMES[tag] || `Tag_0x${tag.toString(16).toUpperCase()}`;

    // Sub-IFDs
    if (tagName === "ExifIFDPointer" || tagName === "GPSInfoIFDPointer") {
      parseIFD(buf, tiffOffset, tiffOffset + valOrOff, isLE, targetObj);
      continue;
    }

    const val = readTiffData(buf, tiffOffset, isLE, type, count, valOrOff);
    if (val !== undefined && val !== null) {
      targetObj[tagName] = val;
    }
  }

  return targetObj;
}

export function extractExifMetadata(buffer) {
  if (!buffer || buffer.length < 16) return null;

  // Cari marker JPEG Exif APP1 (0xFFE1)
  let tiffOffset = -1;
  for (let i = 0; i < Math.min(buffer.length - 14, 65536); i++) {
    if (
      buffer[i] === 0xff &&
      buffer[i + 1] === 0xe1 &&
      buffer.toString("latin1", i + 4, i + 8) === "Exif" &&
      buffer[i + 8] === 0x00 &&
      buffer[i + 9] === 0x00
    ) {
      tiffOffset = i + 10;
      break;
    }
  }

  // Jika tidak ditemukan JPEG Exif, periksa WebP EXIF
  if (tiffOffset === -1) {
    const riff = buffer.toString("latin1", 0, 4);
    const webp = buffer.toString("latin1", 8, 12);
    if (riff === "RIFF" && webp === "WEBP") {
      for (let i = 12; i < buffer.length - 8; i++) {
        if (buffer.toString("latin1", i, i + 4) === "EXIF") {
          tiffOffset = i + 8;
          break;
        }
      }
    }
  }

  if (tiffOffset === -1 || tiffOffset + 8 > buffer.length) return null;

  const endianStr = buffer.toString("latin1", tiffOffset, tiffOffset + 2);
  const isLE = endianStr === "II";
  if (!isLE && endianStr !== "MM") return null;

  const readU32 = (off) => (isLE ? buffer.readUInt32LE(off) : buffer.readUInt32BE(off));
  const ifd0Offset = tiffOffset + readU32(tiffOffset + 4);

  const rawTags = {};
  parseIFD(buffer, tiffOffset, ifd0Offset, isLE, rawTags);

  // Parse GPS coordinates to Decimal Degrees
  let coordinates = null;
  if (Array.isArray(rawTags.GPSLatitude) && Array.isArray(rawTags.GPSLongitude)) {
    const lat = rawTags.GPSLatitude[0] + rawTags.GPSLatitude[1] / 60 + (rawTags.GPSLatitude[2] || 0) / 3600;
    const lon = rawTags.GPSLongitude[0] + rawTags.GPSLongitude[1] / 60 + (rawTags.GPSLongitude[2] || 0) / 3600;
    const latRef = rawTags.GPSLatitudeRef === "S" ? -1 : 1;
    const lonRef = rawTags.GPSLongitudeRef === "W" ? -1 : 1;
    coordinates = {
      latitude: lat * latRef,
      longitude: lon * lonRef,
      mapsUrl: `https://www.google.com/maps?q=${lat * latRef},${lon * lonRef}`,
    };
  }

  return {
    camera: {
      make: rawTags.Make || "-",
      model: rawTags.Model || "-",
      software: rawTags.Software || "-",
      lens: rawTags.LensModel || "-",
    },
    capture: {
      dateTime: rawTags.DateTimeOriginal || rawTags.DateTime || "-",
      iso: rawTags.ISOSpeedRatings || "-",
      fNumber: rawTags.FNumber ? `f/${rawTags.FNumber}` : "-",
      exposureTime: rawTags.ExposureTime ? `${rawTags.ExposureTime}s` : "-",
      focalLength: rawTags.FocalLength ? `${rawTags.FocalLength}mm` : "-",
    },
    gps: coordinates,
    rawTags,
  };
}
