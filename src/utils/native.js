import { createRequire } from "module";
import { isTermux } from "./termux.js";

const require = createRequire(import.meta.url);

const state = {
  sharp: undefined,
  canvas: undefined,
  webpmux: undefined,
  warned: new Set(),
};

function warnOnce(key, message) {
  if (state.warned.has(key)) return;
  state.warned.add(key);
  console.warn(message);
}

export function getSharp() {
  if (state.sharp !== undefined) return state.sharp;
  try {
    const mod = require("sharp");
    state.sharp = mod && mod.default ? mod.default : mod;
  } catch (err) {
    state.sharp = null;
    warnOnce(
      "sharp",
      `[native] sharp tidak tersedia (${err?.code || err?.message}). ` +
        `Fitur gambar memakai fallback ffmpeg. ${isTermux() ? "Di Termux: pkg install libvips, lalu npm rebuild sharp." : ""}`
    );
  }
  return state.sharp;
}

export function requireSharp() {
  const sharp = getSharp();
  if (!sharp) {
    throw new Error(
      "Modul 'sharp' tidak tersedia di perangkat ini." +
        (isTermux()
          ? " Di Termux jalankan: pkg install libvips && npm rebuild sharp. Fitur ini otomatis memakai fallback bila memungkinkan."
          : " Jalankan: npm rebuild sharp.")
    );
  }
  return sharp;
}

export function getCanvas() {
  if (state.canvas !== undefined) return state.canvas;
  try {
    state.canvas = require("@napi-rs/canvas");
  } catch (err) {
    state.canvas = null;
    warnOnce(
      "canvas",
      `[native] @napi-rs/canvas tidak tersedia (${err?.code || err?.message}). ` +
        `Fitur canvas (stiker teks, brat, qris card, struk) dinonaktifkan sebagian.`
    );
  }
  return state.canvas;
}

export function requireCanvas() {
  const canvas = getCanvas();
  if (!canvas) {
    throw new Error(
      "Modul '@napi-rs/canvas' tidak tersedia di perangkat ini." +
        (isTermux()
          ? " Di Termux jalankan: pkg update && pkg install nodejs && npm install @napi-rs/canvas --include=optional."
          : " Jalankan: npm install @napi-rs/canvas.")
    );
  }
  return canvas;
}

export function getWebpmux() {
  if (state.webpmux !== undefined) return state.webpmux;
  try {
    const mod = require("node-webpmux");
    state.webpmux = mod && mod.default ? mod.default : mod;
  } catch (err) {
    state.webpmux = null;
    warnOnce(
      "webpmux",
      `[native] node-webpmux tidak tersedia (${err?.code || err?.message}). ` +
        `Metadata EXIF stiker dilewati (stiker tetap terkirim tanpa pack name).`
    );
  }
  return state.webpmux;
}

export function nativeStatus() {
  return {
    sharp: !!getSharp(),
    canvas: !!getCanvas(),
    webpmux: !!getWebpmux(),
  };
}
