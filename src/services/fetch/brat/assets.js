import fs from "fs";
import fsp from "fs/promises";
import { requireCanvas } from "@/src/utils/native.js";
import { ensureEmojiFont } from "@/src/utils/emoji-font.js";
import { request } from "@/src/utils/request.js";
import {
  ASSETS_DIR,
  BRAT_FONT_PATH,
  BRAT_FONT_URL,
  TEXT_STYLE,
  DOWNLOAD_TIMEOUT_MS,
  DOWNLOAD_MAX_BYTES,
} from "./config.js";

function isFontBuffer(buf) {
  if (!buf || buf.length < 8) return false;
  if (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00) return true;
  const head = buf.subarray(0, 4).toString("ascii");
  return head === "OTTO" || head === "wOF2" || head === "wOFF";
}

function isImageBuffer(buf) {
  if (!buf || buf.length < 8) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return true;
  }
  return false;
}

async function downloadValidated(url, validate, label) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const buf = await request.buffer(url, { timeout: DOWNLOAD_TIMEOUT_MS, retries: 1 });
      if (buf.length === 0 || buf.length > DOWNLOAD_MAX_BYTES) {
        throw new Error("ukuran file tidak wajar");
      }
      if (!validate(buf)) {
        throw new Error("isi file bukan format yang diharapkan (kemungkinan halaman error)");
      }
      return buf;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Gagal download ${label}: ${lastErr?.message || lastErr}`);
}

let fontReadyPromise = null;

export async function ensureFont() {
  if (!fontReadyPromise) {
    fontReadyPromise = (async () => {
      if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
      }
      let needDownload = true;
      if (fs.existsSync(BRAT_FONT_PATH)) {
        try {
          const existing = await fsp.readFile(BRAT_FONT_PATH);
          if (isFontBuffer(existing)) {
            needDownload = false;
          } else {
            await fsp.unlink(BRAT_FONT_PATH).catch(() => {});
          }
        } catch {
          needDownload = true;
        }
      }
      if (needDownload) {
        const buf = await downloadValidated(BRAT_FONT_URL, isFontBuffer, "font brat");
        await fsp.writeFile(BRAT_FONT_PATH, buf);
      }
      const { GlobalFonts } = requireCanvas();
      GlobalFonts.registerFromPath(BRAT_FONT_PATH, TEXT_STYLE.fontFamily);
      try {
        await ensureEmojiFont();
      } catch (_) {}
    })().catch((err) => {
      fontReadyPromise = null;
      throw new Error(`Font brat tidak tersedia: ${err.message}`);
    });
  }
  return fontReadyPromise;
}

export async function loadTemplateImage(template) {
  if (template.isClassic) return null;

  if (template.localPath && fs.existsSync(template.localPath)) {
    try {
      const local = await fsp.readFile(template.localPath);
      if (!isImageBuffer(local)) throw new Error("file template korup");
      return await requireCanvas().loadImage(local);
    } catch {
      await fsp.unlink(template.localPath).catch(() => {});
    }
  }

  if (template.url) {
    const buf = await downloadValidated(template.url, isImageBuffer, "template brat");
    if (template.localPath) {
      try {
        await fsp.writeFile(template.localPath, buf);
      } catch (_) {}
    }
    return await requireCanvas().loadImage(buf);
  }

  throw new Error("Template gambar tidak ditemukan");
}
