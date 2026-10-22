import { scanCodes, scanCodesFromMessage } from "./scanner.js";

/**
 * Pemroses isi kode yang discan (QR guru / barcode).
 *
 * Format resmi Telkom Schools: QR berisi array JSON yang elemen pertamanya
 * adalah string JSON, contoh:
 *   ["{\"type\":\"QR Datang\",\"date\":\"2026-10-22\",\"code\":\"...\"}"]
 *
 * Format polos (mis. barcode 1D) tetap dipakai apa adanya sebagai `raw`.
 */

export { scanCodes, scanCodesFromMessage };

/**
 * Parse isi QR resmi Telkom Schools.
 * Mengembalikan objek payload, atau null bila formatnya tidak dikenali.
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

/**
 * Parse kode yang discan menjadi bentuk siap pakai.
 * @returns {{payload: object|null, raw: string, kind: string|null, format: string}}
 */
export function parseAttendanceCode(raw, format = "unknown") {
  const text = String(raw || "").trim();
  const payload = parseQrPayload(text);
  return {
    payload,
    raw: text,
    format,
    kind: payload?.type ? qrTypeToKind(payload.type) : null,
  };
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

/** Decode QR dari buffer gambar (helper lama, tetap dipakai test). */
export async function decodeQrFromBuffer(buffer) {
  const codes = await scanCodes(buffer);
  return codes.length ? codes[0].text : null;
}
