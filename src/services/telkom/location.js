/**
 * Lokasi siswa untuk presensi Telkom Schools.
 *
 * Penting: bot TIDAK memalsukan koordinat. Yang dipakai:
 *  1. Location native WhatsApp (student share lokasi -> koordinat asli).
 *  2. GPS EXIF dari foto (dipakai kalau student kirim file/screenshot yang
 *     masih menyimpan EXIF lokasi).
 *
 * Server sekolah yang tetap memvalidasi radius lokasi.
 */

/** Ambil lokasi dari pesan WhatsApp (Share Location). */
export function extractLocationFromMessage(msg) {
  const location = msg?.message?.locationMessage;
  if (!location) return null;
  const latitude = Number(location.degreesLatitude);
  const longitude = Number(location.degreesLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return {
    latitude,
    longitude,
    name: String(location.name || "").slice(0, 80),
    address: String(location.address || "").slice(0, 120),
  };
}

/** Parse GPS dari buffer EXIF (header TIFF). */
export function extractGpsFromExif(exifBuffer) {
  if (!exifBuffer || exifBuffer.length < 12) return null;
  let offset = 0;
  // Skip "Exif\0\0" bila ada.
  if (exifBuffer[0] === 0x45 && exifBuffer[1] === 0x78) offset = 6;

  const tiff = exifBuffer.subarray(offset);
  if (tiff.length < 8) return null;

  const marker = tiff.toString("ascii", 0, 2);
  const little = marker === "II";
  if (!little && marker !== "MM") return null;

  const u16 = (pos) => (little ? tiff.readUInt16LE(pos) : tiff.readUInt16BE(pos));
  const u32 = (pos) => (little ? tiff.readUInt32LE(pos) : tiff.readUInt32BE(pos));

  if (u16(2) !== 42) return null;
  const ifd0 = u32(4);
  if (ifd0 + 2 > tiff.length) return null;

  const readIfd = (start) => {
    const out = new Map();
    const count = u16(start);
    for (let i = 0; i < count; i++) {
      const entry = start + 2 + i * 12;
      if (entry + 12 > tiff.length) break;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const count2 = u32(entry + 4);
      const size = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] || 0;
      const bytes = size * count2;

      // SHORT/LONG dengan count=1 menyimpan nilainya inline di field value.
      const inlineNumber = count2 === 1 && (type === 3 || type === 4);
      let pos = null;
      let value = null;

      if (inlineNumber) {
        value = type === 3 ? u16(entry + 8) : u32(entry + 8);
      } else if (bytes > 4) {
        pos = u32(entry + 8);
        if (pos + bytes > tiff.length) continue;
      } else {
        pos = entry + 8; // ASCII/UNDEFINED pendek: inline di field value
      }

      out.set(tag, { type, count: count2, pos, value });
    }
    return out;
  };

  const ifd0Tags = readIfd(ifd0);
  const gpsTag = ifd0Tags.get(0x8825);
  if (!gpsTag) return null;
  const gpsOffset = gpsTag.value ?? gpsTag.pos;
  if (!Number.isFinite(gpsOffset)) return null;
  const gpsIfd = readIfd(gpsOffset);

  const readRationals = (tag) => {
    const item = gpsIfd.get(tag);
    if (!item || item.pos === null) return null;
    const values = [];
    for (let i = 0; i < item.count; i++) {
      const pos = item.pos + i * 8;
      if (pos + 8 > tiff.length) return null;
      const num = little ? tiff.readUInt32LE(pos) : tiff.readUInt32BE(pos);
      const den = little ? tiff.readUInt32LE(pos + 4) : tiff.readUInt32BE(pos + 4);
      if (!den) return null;
      values.push(num / den);
    }
    return values;
  };

  const readAscii = (tag) => {
    const item = gpsIfd.get(tag);
    if (!item || item.pos === null) return "";
    let out = "";
    for (let i = 0; i < item.count; i++) {
      const pos = item.pos + i;
      if (pos >= tiff.length) break;
      const code = tiff[pos];
      if (!code) break;
      out += String.fromCharCode(code);
    }
    return out.trim();
  };

  const lat = readRationals(0x0002);
  const lon = readRationals(0x0004);
  if (!lat || !lon || lat.length < 3 || lon.length < 3) return null;

  const latRef = readAscii(0x0001) || "N";
  const lonRef = readAscii(0x0003) || "E";

  const toDecimal = (dms, ref) => {
    const value = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return /[SsWw]/.test(ref) ? -value : value;
  };

  const latitude = toDecimal(lat, latRef);
  const longitude = toDecimal(lon, lonRef);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude, source: "exif" };
}

/** Ambil GPS dari file gambar (bila EXIF-nya masih ada). */
export async function extractGpsFromImage(buffer) {
  if (!buffer || !buffer.length) return null;
  try {
    const sharp = await import("sharp");
    const mod = sharp.default || sharp;
    const metadata = await mod(buffer).metadata();
    if (!metadata.exif) return null;
    return extractGpsFromExif(metadata.exif);
  } catch (_) {
    return null;
  }
}

/** Format lokasi untuk ditampilkan ke user. */
export function formatLocation(location) {
  if (!location) return "-";
  const { latitude, longitude } = location;
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

/**
 * Normalisasi ke format yang dipakai aplikasi resmi: { latitude, longitude }.
 */
export function toApiLocation(location) {
  if (!location) return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}
