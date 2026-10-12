import fs from "fs";
import path from "path";

export function getFfmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const localBin = path.join(process.cwd(), "bin", "ffmpeg");
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  const localBinWin = path.join(process.cwd(), "bin", "ffmpeg.exe");
  if (fs.existsSync(localBinWin)) {
    return localBinWin;
  }
  for (const sysPath of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (fs.existsSync(sysPath)) {
      return sysPath;
    }
  }
  return "ffmpeg";
}

export const ASSETS_DIR = path.join(process.cwd(), "assets", "brat");
export const BRAT_FONT_PATH = path.join(ASSETS_DIR, "ArialNarrow.ttf");
export const BRAT_FONT_URL =
  "https://raw.githubusercontent.com/Arifzyn19/brat-generator/master/src/fonts/arialnarrow.ttf";

export const TEMPLATES = {
  classic: {
    isClassic: true,
    width: 512,
    height: 512,
    safeZone: { a: 40, b: 472, c: 40, d: 472 },
  },
  vermeil: {
    localPath: path.join(ASSETS_DIR, "Vermile.jpg"),
    url: "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Vermile.jpg",
    width: 1254,
    height: 1254,
    safeZone: { a: 655, b: 1118, c: 282, d: 993 },
    stroke: true,
  },
  gojo: {
    localPath: path.join(ASSETS_DIR, "Gojo.jpeg"),
    url: "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Gojo.jpeg",
    width: 1254,
    height: 1254,
    safeZone: { a: 660, b: 1180, c: 270, d: 990 },
    stroke: true,
  },
};

export const TEXT_STYLE = {
  fontFamily: "Arial Narrow",
  maxFontSize: 90,
  growMaxFontSize: 200,
  minFontSize: 14,
  lineHeight: 1.18,
  color: "#111111",
  strokeColor: "rgba(255, 255, 255, 0.9)",
  align: "justify",
};

export const VIDEO_CONFIG = {
  fps: 15,
  width: 512,
  height: 512,
  lyric: {
    maxWordPerLayer: 5,
    frameDuration: 0.5,
    lastFrameDuration: 1.5,
  },
};

export const MAX_BRAT_STATIC_LENGTH = 100;
export const MAX_BRAT_VIDEO_LENGTH = 50;
export const MAX_BRAT_VIDEO_WORDS = 10;

export const DOWNLOAD_TIMEOUT_MS = 15000;
export const DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024;
