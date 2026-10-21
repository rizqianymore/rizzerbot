/**
 * Decoder QR untuk presensi Telkom Schools.
 *
 * Siswa memotret QR yang ditampilkan guru, lalu mengirim fotonya ke bot.
 * Bot membacanya (jsQR + sharp) dan memakai isi QR itu untuk submit presensi
 * dengan token siswa sendiri — persis seperti aplikasi resmi.
 *
 * Semua dependensi (sharp, jsqr) bersifat opsional: bila tidak tersedia,
 * fungsi ini hanya mengembalikan null (bot tetap jalan tanpa fitur foto).
 */

let sharpMod = null;
let jsQrMod = null;
let depsChecked = false;

async function loadDeps() {
  if (depsChecked) return { sharp: sharpMod, jsQR: jsQrMod };
  depsChecked = true;
  try {
    const sharp = await import("sharp");
    sharpMod = sharp.default || sharp;
  } catch (_) {
    sharpMod = null;
  }
  try {
    const jsqr = await import("jsqr");
    jsQrMod = jsqr.default || jsqr;
  } catch (_) {
    jsQrMod = null;
  }
  return { sharp: sharpMod, jsQR: jsQrMod };
}

/** Decode QR dari buffer gambar (PNG/JPEG). */
export async function decodeQrFromBuffer(buffer) {
  if (!buffer || !buffer.length) return null;
  const { sharp, jsQR } = await loadDeps();
  if (!sharp || !jsQR) return null;

  const attempts = [{ width: null }, { width: 1200 }, { width: 2000 }];

  for (const attempt of attempts) {
    try {
      let pipeline = sharp(buffer).toColourspace("srgb").ensureAlpha();
      if (attempt.width) pipeline = pipeline.resize({ width: attempt.width, withoutEnlargement: false });
      const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
      const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      if (result?.data) return String(result.data);
    } catch (_) {
      // coba skala berikutnya
    }
  }
  return null;
}

/** Download media dari pesan WhatsApp lalu decode QR-nya. */
export async function decodeQrFromMessage(sock, msg) {
  try {
    const { getMediaBuffer } = await import("@/src/services/fetch/media/buffer.js");
    const buffer = await getMediaBuffer(sock, msg, { maxBytes: 12 * 1024 * 1024 });
    if (!buffer) return null;
    return await decodeQrFromBuffer(buffer);
  } catch (_) {
    return null;
  }
}

/**
 * Parse isi QR resmi Telkom Schools.
 * Aplikasi resmi memindai QR berisi array JSON yang elemen pertamanya
 * adalah string JSON, contoh: ["{\"type\":\"QR Datang\", ...}"]
 */
export function parseQrPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  let value = text;
  try {
    const parsed = JSON.parse(text);
    value = Array.isArray(parsed) ? parsed[0] : parsed;
  } catch (_) {
    return null;
  }

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (_) {
      return null;
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!value.type) return null;
  return value;
}

/** Petakan tipe QR resmi ke jenis presensi (datang/pulang/...). */
export function qrTypeToKind(type) {
  const key = String(type || "")
    .trim()
    .toLowerCase();
  if (key === "qr datang") return "datang";
  if (key === "qr pulang") return "pulang";
  if (key === "qr kelas") return "kelas";
  if (key === "qr aktivitas") return "aktivitas";
  if (key === "qr event") return "event";
  return null;
}
