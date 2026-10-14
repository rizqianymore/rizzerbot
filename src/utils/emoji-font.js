import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { requireCanvas } from "./native.js";
import { request } from "./request.js";

export const EMOJI_FAMILY = "Noto Color Emoji";
export const EMOJI_DIR = path.join(process.cwd(), "assets", "fonts");
export const EMOJI_PATH = path.join(EMOJI_DIR, "NotoColorEmoji.ttf");

const EMOJI_URLS = [
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notocoloremoji/NotoColorEmoji-Regular.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/ofl/notocoloremoji/NotoColorEmoji-Regular.ttf",
];

const SYSTEM_CANDIDATES = [
  "/system/fonts/NotoColorEmoji.ttf",
  "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
  "/usr/share/fonts/NotoColorEmoji.ttf",
  "/usr/share/fonts/truetype/ancient-scripts/NotoColorEmoji.ttf",
  "C:\\Windows\\Fonts\\seguiemj.ttf",
];

const MIN_BYTES = 5 * 1024 * 1024;
const MAX_BYTES = 40 * 1024 * 1024;

function isFontFile(buf) {
  if (!buf || buf.length < 8) return false;
  if (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00) return true;
  const head = buf.subarray(0, 4).toString("ascii");
  return head === "OTTO" || head === "true" || head === "typ1";
}

async function downloadEmoji() {
  let lastErr = null;
  for (const url of EMOJI_URLS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const buf = await request.buffer(url, { timeout: 120000, retries: 0 });
        if (!buf?.length || buf.length < MIN_BYTES || buf.length > MAX_BYTES) {
          throw new Error("ukuran file tidak wajar");
        }
        if (!isFontFile(buf)) {
          throw new Error("isi file bukan font valid");
        }
        await fsp.mkdir(EMOJI_DIR, { recursive: true });
        await fsp.writeFile(EMOJI_PATH, buf);
        return EMOJI_PATH;
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr || new Error("gagal mengunduh font emoji");
}

let emojiPromise = null;

export function ensureEmojiFont() {
  if (!emojiPromise) {
    emojiPromise = (async () => {
      const { GlobalFonts } = requireCanvas();
      for (const sys of SYSTEM_CANDIDATES) {
        try {
          if (sys && fs.existsSync(sys)) {
            GlobalFonts.registerFromPath(sys, EMOJI_FAMILY);
            return EMOJI_FAMILY;
          }
        } catch (_) {}
      }
      try {
        if (fs.existsSync(EMOJI_PATH)) {
          const existing = await fsp.readFile(EMOJI_PATH);
          if (existing.length >= MIN_BYTES && isFontFile(existing)) {
            GlobalFonts.registerFromPath(EMOJI_PATH, EMOJI_FAMILY);
            return EMOJI_FAMILY;
          }
          await fsp.unlink(EMOJI_PATH).catch(() => {});
        }
      } catch (_) {}
      const downloaded = await downloadEmoji();
      GlobalFonts.registerFromPath(downloaded, EMOJI_FAMILY);
      return EMOJI_FAMILY;
    })().catch((err) => {
      emojiPromise = null;
      throw new Error(`Font emoji tidak tersedia: ${err?.message || err}`);
    });
  }
  return emojiPromise;
}

export function emojiFontStack(base) {
  return `"${base}","${EMOJI_FAMILY}",sans-serif`;
}
