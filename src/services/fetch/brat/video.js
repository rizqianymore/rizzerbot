import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getFfmpegPath, VIDEO_CONFIG } from "./config.js";
import { ensureFont, loadTemplateImage } from "./assets.js";
import { buildRevealFrames } from "./text.js";
import { layoutText } from "./layout.js";
import { renderBratFrame } from "./render.js";

const execFileAsync = promisify(execFile);

function escapeConcatPath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}

function buildManifest(frames, framePaths) {
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    lines.push(`file '${escapeConcatPath(framePaths[i])}'`);
    lines.push(`duration ${frames[i].duration}`);
  }
  lines.push(`file '${escapeConcatPath(framePaths[framePaths.length - 1])}'`);
  return lines.join("\n");
}

async function encodeVideo(concatPath, outputPath, configObj) {
  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-vf",
    `fps=${configObj.fps},scale=${configObj.width}:${configObj.height}:flags=lanczos`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "24",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  const ffmpegCmd = getFfmpegPath();
  await execFileAsync(ffmpegCmd, args, {
    maxBuffer: 1024 * 1024 * 10,
    timeout: 30000,
    killSignal: "SIGKILL",
  });
}

export async function createBratVideo(text, template, options = {}) {
  await ensureFont();
  const frames = buildRevealFrames(text, VIDEO_CONFIG);
  if (!frames.length) {
    throw new Error("Teks kosong untuk membuat video stiker");
  }

  const cacheBase = path.join(process.cwd(), "assets", "cache");
  if (!fs.existsSync(cacheBase)) {
    try {
      fs.mkdirSync(cacheBase, { recursive: true });
    } catch (_) {}
  }
  const tmpDir = await fsp.mkdtemp(path.join(cacheBase, "bratvid-"));
  const outputPath = path.join(tmpDir, "output.mp4");

  try {
    const image = await loadTemplateImage(template);
    const layout = layoutText(text, template);

    const framePaths = frames.map((_, index) => {
      return path.join(tmpDir, `frame-${String(index + 1).padStart(4, "0")}.png`);
    });

    for (let index = 0; index < frames.length; index++) {
      const canvas = await renderBratFrame(image, frames[index].text, template, layout, options);
      const buf = await canvas.encode("png");
      await fsp.writeFile(framePaths[index], buf);
    }

    const concatPath = path.join(tmpDir, "concat.txt");
    await fsp.writeFile(concatPath, buildManifest(frames, framePaths));

    await encodeVideo(concatPath, outputPath, VIDEO_CONFIG);
    return await fsp.readFile(outputPath);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
