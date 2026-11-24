import fsp from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireCanvas } from "@/src/utils/native.js";
import { getFfmpegPath, TEMPLATES } from "./config.js";
import { ensureFont, loadTemplateImage } from "./assets.js";
import { drawCenteredText } from "./layout.js";
import { createSticker } from "../media/sticker.js";

const execFileAsync = promisify(execFile);

export async function createCat1AnimatedSticker(text = "", options = {}) {
  await ensureFont();
  const template = TEMPLATES.cat1 || {
    localPath: path.join(process.cwd(), "assets", "brat", "cat1.png"),
    width: 715,
    height: 720,
    safeZone: { a: 540, b: 685, c: 45, d: 670 },
  };

  const img = await loadTemplateImage(template);
  const cacheBase = path.join(process.cwd(), "assets", "cache");
  await fsp.mkdir(cacheBase, { recursive: true });
  const tmpDir = await fsp.mkdtemp(path.join(cacheBase, "cat1-anim-"));
  const outWebp = path.join(tmpDir, "cat1_animated.webp");

  const W = template.width || 715;
  const H = template.height || 720;
  const frameCount = 14;
  const fps = 14;
  const { createCanvas } = requireCanvas();
  const targetWidth = 512;
  const targetHeight = 512;
  const scale = targetWidth / W;

  try {
    for (let f = 0; f < frameCount; f++) {
      const canvas = createCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = options.bgColor || "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const phase = (f / frameCount) * Math.PI * 2;
      // Gerakan naik-turun telinga dengan vertical mesh warp
      const maxOffset = Math.sin(phase) * 22; // -22 s/d +22 px di original space

      // 1. Gambar Bongo Cat utuh di bawah garis Y=255
      ctx.drawImage(img, 0, 255, W, H - 255, 0, 255 * scale, targetWidth, (H - 255) * scale);

      // 2. Gambar area kepala & dahi tengah (X: 235..465, Y: 180..260) utuh
      ctx.drawImage(img, 235, 180, 230, 80, 235 * scale, 180 * scale, 230 * scale, 80 * scale);

      // 3. Irisan vertikal kontinu untuk Telinga Kiri (X: 160 s/d 240)
      for (let x = 160; x <= 240; x += 2) {
        let weight = 0;
        if (x <= 175) {
          weight = (x - 160) / (175 - 160);
        } else {
          weight = (240 - x) / (240 - 175);
        }
        weight = Math.max(0, Math.min(1, weight));

        const colDy = maxOffset * weight;
        const srcH = 75; // Y: 180 s/d 255

        ctx.drawImage(
          img,
          x, 180, 2, srcH,
          x * scale, (180 + colDy) * scale, 2 * scale, (255 - (180 + colDy)) * scale
        );
      }

      // 4. Irisan vertikal kontinu untuk Telinga Kanan (X: 460 s/d 550)
      for (let x = 460; x <= 550; x += 2) {
        let weight = 0;
        if (x <= 530) {
          weight = (x - 460) / (530 - 460);
        } else {
          weight = (550 - x) / (550 - 530);
        }
        weight = Math.max(0, Math.min(1, weight));

        const colDy = maxOffset * weight;
        const srcH = 75; // Y: 180 s/d 255

        ctx.drawImage(
          img,
          x, 180, 2, srcH,
          x * scale, (180 + colDy) * scale, 2 * scale, (255 - (180 + colDy)) * scale
        );
      }

      // 5. Render teks Brat jika ada
      if (text && text.trim()) {
        const scaledSafeZone = {
          a: template.safeZone.a * scale,
          b: template.safeZone.b * scale,
          c: template.safeZone.c * scale,
          d: template.safeZone.d * scale,
        };
        drawCenteredText(ctx, text, scaledSafeZone, {
          align: "center",
          stroke: true,
          color: options.color || "#111111",
        });
      }

      const framePath = path.join(tmpDir, `frame_${f}.png`);
      await fsp.writeFile(framePath, canvas.toBuffer("image/png"));
    }

    const args = [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      path.join(tmpDir, "frame_%d.png"),
      "-vcodec",
      "libwebp",
      "-loop",
      "0",
      "-vf",
      `scale=${targetWidth}:${targetHeight}:flags=lanczos,fps=${fps}`,
      "-qscale",
      "75",
      "-preset",
      "default",
      "-an",
      outWebp,
    ];

    await execFileAsync(getFfmpegPath(), args, {
      maxBuffer: 1024 * 1024 * 10,
      timeout: 30000,
    });

    const webpBuffer = await fsp.readFile(outWebp);
    return await createSticker(webpBuffer, {
      pack: "RizzerBot",
      author: "Cat1 Animated",
      type: "animated",
    });
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
