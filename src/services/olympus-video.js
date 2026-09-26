import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Generates an MP4 animation sequence of Zeus Gate opening with lightning & final outcome (WIN/LOSE)
 */
export async function generateOlympusVideo({ isWin, multiplier = 1, score = 0, level = 1 }) {
  const width = 480;
  const height = 480;
  const fps = 10;
  const durationSec = 3.5;
  const totalFrames = Math.floor(fps * durationSec);

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "olympus-vid-"));
  const outputPath = path.join(tmpDir, "zeus_result.mp4");

  try {
    const framePaths = [];

    for (let f = 0; f < totalFrames; f++) {
      const progress = f / totalFrames; // 0 to 1
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      // 1. Dynamic Olympian Background (Dark Mythological Sky)
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 50,
        width / 2, height / 2, width / 2
      );
      if (progress < 0.6) {
        // Charging phase: Dark stormy purple/blue
        grad.addColorStop(0, "#1a0b2e");
        grad.addColorStop(0.7, "#0b0617");
        grad.addColorStop(1, "#030208");
      } else if (isWin) {
        // Victory Gold / Zeus Divine Aura
        grad.addColorStop(0, "#4a3b00");
        grad.addColorStop(0.7, "#241902");
        grad.addColorStop(1, "#0a0701");
      } else {
        // Normal / Defense Held phase
        grad.addColorStop(0, "#161b26");
        grad.addColorStop(0.7, "#0d1117");
        grad.addColorStop(1, "#040608");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Temple Gate Pillars (Olympus Architecture)
      ctx.fillStyle = "rgba(218, 165, 32, 0.35)"; // Gold stone pillar
      ctx.fillRect(30, 40, 40, height - 80);
      ctx.fillRect(width - 70, 40, 40, height - 80);
      // Pillar tops & bases
      ctx.fillStyle = "rgba(255, 215, 0, 0.6)";
      ctx.fillRect(20, 30, 60, 15);
      ctx.fillRect(20, height - 55, 60, 15);
      ctx.fillRect(width - 80, 30, 60, 15);
      ctx.fillRect(width - 80, height - 55, 60, 15);

      // 3. Lightning bolts during animation
      if (f % 3 === 0 || (progress > 0.5 && progress < 0.8)) {
        ctx.strokeStyle = progress > 0.6 && isWin ? "#ffe066" : "#70d6ff";
        ctx.lineWidth = Math.floor(Math.random() * 4) + 2;
        ctx.beginPath();
        let lx = width / 2 + (Math.random() * 60 - 30);
        let ly = 20;
        ctx.moveTo(lx, ly);
        while (ly < height - 60) {
          lx += (Math.random() - 0.5) * 45;
          ly += Math.random() * 50 + 20;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }

      // 4. Central Zeus Avatar & Sacred Symbol
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (progress < 0.6) {
        // Phase 1: Charging Petir & Gate Awakening
        const pulse = Math.sin(progress * Math.PI * 8) * 8;
        ctx.font = `${80 + pulse}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.fillText("⚡", width / 2, height / 2 - 40);

        ctx.font = `bold 24px "DejaVu Sans", "Segoe UI", sans-serif`;
        ctx.fillStyle = "#ffd166";
        ctx.fillText("GATES OF OLYMPUS", width / 2, height / 2 + 50);

        ctx.font = `italic 16px "DejaVu Sans", sans-serif`;
        ctx.fillStyle = "#a0aec0";
        ctx.fillText("Zeus sedang menguji kekuatanmu...", width / 2, height / 2 + 85);
      } else {
        // Phase 2: Outcome Reveal (WIN / BERSABDA)
        if (isWin) {
          // VICTORY
          ctx.font = `95px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
          ctx.fillText("👑", width / 2, height / 2 - 60);

          ctx.font = `bold 32px "DejaVu Sans", sans-serif`;
          ctx.fillStyle = "#ffd700";
          ctx.fillText("BERKAH ZEUS!", width / 2, height / 2 + 25);

          if (multiplier > 1) {
            ctx.font = `bold 26px "DejaVu Sans", sans-serif`;
            ctx.fillStyle = "#ff6b6b";
            ctx.fillText(`⚡ PETIR x${multiplier} MULTIPLIER! ⚡`, width / 2, height / 2 + 65);
          }

          ctx.font = `18px "DejaVu Sans", sans-serif`;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(`Total Power: +${score} Damage`, width / 2, height / 2 + 105);
        } else {
          // DEFENSE HELD / NORMAL
          ctx.font = `90px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
          ctx.fillText("🛡️", width / 2, height / 2 - 60);

          ctx.font = `bold 28px "DejaVu Sans", sans-serif`;
          ctx.fillStyle = "#cbd5e1";
          ctx.fillText("GERBANG BERTAHAN", width / 2, height / 2 + 25);

          ctx.font = `italic 17px "DejaVu Sans", sans-serif`;
          ctx.fillStyle = "#94a3b8";
          ctx.fillText("Pertahanan Olympus belum tembus", width / 2, height / 2 + 65);

          ctx.font = `16px "DejaVu Sans", sans-serif`;
          ctx.fillStyle = "#64748b";
          ctx.fillText(`Level Ksatria: ${level}`, width / 2, height / 2 + 100);
        }
      }

      // Save frame image
      const framePath = path.join(tmpDir, `frame_${String(f).padStart(4, "0")}.png`);
      const buf = canvas.toBuffer("image/png");
      await fsp.writeFile(framePath, buf);
      framePaths.push(framePath);
    }

    // Build FFmpeg Concat file
    const concatPath = path.join(tmpDir, "concat.txt");
    const frameDuration = (1 / fps).toFixed(3);
    const manifest = framePaths.map((fp) => `file '${fp}'\nduration ${frameDuration}`).join("\n");
    await fsp.writeFile(concatPath, manifest);

    // Encode to fast mp4 video
    const ffmpegArgs = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatPath,
      "-vf", `fps=${fps},scale=${width}:${height}:flags=fast_bilinear`,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "32",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ];

    await execFileAsync("ffmpeg", ffmpegArgs, { maxBuffer: 1024 * 1024 * 10 });
    const videoBuffer = await fsp.readFile(outputPath);
    return videoBuffer;
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
