import fsp from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getFfmpegPath, VIDEO_CONFIG } from "./config.js";
import { ensureFont, loadTemplateImage } from "./assets.js";
import { buildRevealFrames } from "./text.js";
import { prepareBratLayout, renderBratVideoFrames } from "./render.js";

const execFileAsync = promisify(execFile);

function escapeConcatPath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}

function buildManifest(framePaths, frames) {
  const lines = [];
  for (let i = 0; i < framePaths.length; i++) {
    lines.push(`file '${escapeConcatPath(framePaths[i])}'`);
    lines.push(`duration ${frames[i].duration}`);
  }
  lines.push(`file '${escapeConcatPath(framePaths.at(-1))}'`);
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
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  await execFileAsync(getFfmpegPath(), args, {
    maxBuffer: 1024 * 1024 * 10,
    timeout: 60000,
    killSignal: "SIGKILL",
  });
}

export async function createBratVideo(text, template, options = {}) {
  await ensureFont();

  const layout = await prepareBratLayout(text, template);
  const frames = buildRevealFrames(layout.lines, VIDEO_CONFIG);
  if (!frames.length) {
    throw new Error("Teks kosong untuk membuat video stiker");
  }

  const cacheBase = path.join(process.cwd(), "assets", "cache");
  await fsp.mkdir(cacheBase, { recursive: true });
  const tmpDir = await fsp.mkdtemp(path.join(cacheBase, "bratvid-"));
  const outputPath = path.join(tmpDir, "output.mp4");

  try {
    const image = await loadTemplateImage(template);
    const buffers = await renderBratVideoFrames(image, template, layout, frames, options);

    const framePaths = [];
    for (let index = 0; index < buffers.length; index++) {
      const framePath = path.join(tmpDir, `frame-${String(index + 1).padStart(4, "0")}.png`);
      await fsp.writeFile(framePath, buffers[index]);
      framePaths.push(framePath);
    }

    const concatPath = path.join(tmpDir, "concat.txt");
    await fsp.writeFile(concatPath, buildManifest(framePaths, frames));

    await encodeVideo(concatPath, outputPath, VIDEO_CONFIG);
    return await fsp.readFile(outputPath);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
