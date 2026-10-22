/**
 * Scanner kode (QR & barcode 1D) untuk absensi Telkom Schools.
 *
 * Alur: WhatsApp image -> buffer -> decode (zxing-wasm & jsQR) -> isi QR.
 *
 * Semua dependensi opsional (zxing-wasm, jsqr, sharp): bila tidak tersedia,
 * fungsi mengembalikan array kosong dan bot tetap jalan.
 */

const MAX_SCAN_BYTES = 12 * 1024 * 1024;

let deps = null;
let depsChecked = false;

async function loadDeps() {
  if (depsChecked) return deps;
  depsChecked = true;
  deps = { zxing: null, jsQR: null, sharp: null };

  // zxing-wasm: pakai build CJS (Node) — build ESM mencoba fetch file .wasm
  // lewat fetch() yang tidak mendukung file:// di Node.
  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const mod = require("zxing-wasm/reader");
    deps.zxing = mod.readBarcodes || mod.default?.readBarcodes || null;

    // Beri wasm langsung dari disk supaya tidak perlu fetch (deterministik).
    try {
      const fs = require("fs");
      const wasmPath = require.resolve("zxing-wasm/reader/zxing_reader.wasm");
      mod.setZXingModuleOverrides?.({ wasmBinary: fs.readFileSync(wasmPath) });
    } catch (_) {}
  } catch (_) {
    try {
      const mod = await import("zxing-wasm/reader");
      deps.zxing = mod.readBarcodes || mod.default?.readBarcodes || null;
    } catch (_) {}
  }

  try {
    const mod = await import("jsqr");
    deps.jsQR = mod.default || mod;
  } catch (_) {}

  try {
    const mod = await import("sharp");
    deps.sharp = mod.default || mod;
  } catch (_) {}

  return deps;
}

/** Scan buffer gambar (PNG/JPEG) → daftar kode yang terbaca. */
export async function scanCodes(buffer) {
  if (!buffer || !buffer.length) return [];
  if (buffer.length > MAX_SCAN_BYTES) return [];

  const { zxing, jsQR, sharp } = await loadDeps();
  const found = [];
  const push = (format, text) => {
    const value = String(text || "").trim();
    if (!value) return;
    if (found.some((item) => item.text === value)) return;
    found.push({ format: String(format || "unknown"), text: value });
  };

  // 1) zxing-wasm langsung pada file gambar (QR + barcode 1D)
  if (zxing) {
    try {
      const results = await zxing(new Uint8Array(buffer), { tryHarder: true });
      for (const item of results || []) push(item?.format, item?.text);
    } catch (_) {}
  }

  // 2) zxing pada versi yang diperbesar + grayscale (kode kecil/blur)
  if (zxing && sharp && !found.length) {
    for (const width of [1600, 2400]) {
      try {
        const png = await sharp(buffer)
          .toColourspace("srgb")
          .resize({ width, withoutEnlargement: false })
          .sharpen()
          .png()
          .toBuffer();
        const results = await zxing(new Uint8Array(png), { tryHarder: true });
        for (const item of results || []) push(item?.format, item?.text);
        if (found.length) break;
      } catch (_) {}
    }
  }

  // 3) jsQR sebagai cadangan
  if (jsQR && sharp && !found.length) {
    for (const width of [null, 1200, 2000]) {
      try {
        let pipeline = sharp(buffer).toColourspace("srgb").ensureAlpha();
        if (width) pipeline = pipeline.resize({ width, withoutEnlargement: false });
        const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
        const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
        if (result?.data) {
          push("QRCode", result.data);
          break;
        }
      } catch (_) {}
    }
  }

  return found;
}

/** Scan media dari pesan WhatsApp (foto/screenshot QR guru). */
export async function scanCodesFromMessage(sock, msg) {
  try {
    const { getMediaBuffer } = await import("@/src/services/fetch/media/buffer.js");
    const buffer = await getMediaBuffer(sock, msg, { maxBytes: MAX_SCAN_BYTES });
    if (!buffer) return [];
    return await scanCodes(buffer);
  } catch (_) {
    return [];
  }
}
