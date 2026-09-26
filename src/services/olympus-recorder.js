import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const GAME_HTML_PATH = path.join(process.cwd(), "assets", "games", "olympus", "index.html");

/**
 * Runs the authentic 3D WebGL "Gates of Olympus" engine via Puppeteer,
 * simulates tower defense battle gameplay, captures frames, and encodes into MP4.
 */
export async function recordRealOlympusGameplay({ durationSec = 3, fps = 8 } = {}) {
  const { default: puppeteer } = await import("puppeteer");
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "olympus-rec-"));
  const outputPath = path.join(tmpDir, "olympus_gameplay.mp4");

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-webgl",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 640, height: 480 });

    const fileUrl = `file://${GAME_HTML_PATH}`;
    await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Sembunyikan seluruh banner, teks hint Firefox, menu, dan jalankan game
    await page.evaluate(() => {
      const menu = document.getElementById("menucontainer");
      if (menu) menu.remove();
      const instruct = document.getElementById("instructcontainer");
      if (instruct) instruct.remove();
      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((f) => f.remove());
      const audio = document.getElementById("backtrack");
      if (audio) audio.remove();
      if (typeof startGame === "function") startGame();
    });

    await new Promise((r) => setTimeout(r, 600));

    // Pasang menara pertahanan
    try {
      await page.keyboard.press("Digit1");
      await page.mouse.click(320, 240);
      await page.keyboard.press("Digit2");
      await page.mouse.click(320, 360);
    } catch (_) {}

    const totalFrames = Math.floor(durationSec * fps);
    const frameInterval = Math.floor(1000 / fps);
    const framePaths = [];

    // Capture gameplay frames
    for (let f = 0; f < totalFrames; f++) {
      const framePath = path.join(tmpDir, `frame_${String(f).padStart(4, "0")}.png`);
      await page.screenshot({ path: framePath });
      framePaths.push(framePath);
      await new Promise((r) => setTimeout(r, frameInterval));
    }

    // Build FFmpeg Concat file
    const concatPath = path.join(tmpDir, "concat.txt");
    const frameDuration = (1 / fps).toFixed(3);
    const manifest = framePaths.map((fp) => `file '${fp}'\nduration ${frameDuration}`).join("\n");
    await fsp.writeFile(concatPath, manifest);

    // Encode to lightweight MP4 video with FFmpeg
    const ffmpegArgs = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatPath,
      "-vf", `fps=${fps},scale=480:360:flags=fast_bilinear`,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "30",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ];

    await execFileAsync("ffmpeg", ffmpegArgs, { maxBuffer: 1024 * 1024 * 10 });
    const videoBuffer = await fsp.readFile(outputPath);
    return videoBuffer;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
