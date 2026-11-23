import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const TEMPLATE_PATH = path.join(process.cwd(), "assets", "maker", "iqc_iphone_clean.png");
let cachedTemplate = null;

async function getTemplate() {
  if (!cachedTemplate && fs.existsSync(TEMPLATE_PATH)) {
    cachedTemplate = await loadImage(TEMPLATE_PATH);
  }
  return cachedTemplate;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function renderIqcImage(userText, userTime) {
  const baseImg = await getTemplate();
  if (!baseImg) throw new Error("Template IQC tidak ditemukan.");

  const scale = 2;
  const W = baseImg.width * scale;
  const H = baseImg.height * scale;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(baseImg, 0, 0, W, H);

  const bubbleX = 10 * scale;
  const bubbleY = 126 * scale;

  const fontSize = 11 * scale;
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  const maxW = 160 * scale;
  const words = userText.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);

  const textWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const timeWidth = ctx.measureText(userTime).width * 0.75;
  const bubbleW = Math.max(90 * scale, Math.min(220 * scale, textWidth + timeWidth + 24 * scale));
  const lineHeight = 14 * scale;
  const bubbleH = Math.max(30 * scale, lines.length * lineHeight + 16 * scale);

  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 8 * scale);
  ctx.fillStyle = "#363638";
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  lines.forEach((l, idx) => {
    ctx.fillText(l, bubbleX + 8 * scale, bubbleY + 6 * scale + idx * lineHeight);
  });

  ctx.font = `${fontSize * 0.7}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(userTime, bubbleX + bubbleW - 6 * scale, bubbleY + bubbleH - 4 * scale);

  return canvas.toBuffer("image/png");
}

export default {
  name: "iqc2",
  aliases: ["iqc"],
  description: "Maker iPhone quoted WhatsApp chat tema gelap asli",
  usage: "<teks>|[jam]",
  premiumOnly: true,
  cooldownMs: 5000,
  category: "Sticker",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    const text = args.join(" ").trim();

    if (!text) {
      return reply(
        "Contoh penggunaan:\n\n" +
        "Otomatis:\n.iqc inget, gabole ngemis\n\n" +
        "Manual Jam:\n.iqc inget, gabole ngemis | 11:26"
      );
    }

    const [rawMsg, rawChatTime] = text.split("|");

    if (!rawMsg?.trim()) {
      return reply("Teks tidak boleh kosong! Contoh: *.iqc inget, gabole ngemis*");
    }

    const now = new Date();
    const autoTime = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });

    const chatTime = rawChatTime ? rawChatTime.trim() : autoTime;

    await sendTyping();

    try {
      const buffer = await renderIqcImage(rawMsg.trim(), chatTime);
      return await sock.sendMessage(msg.key.remoteJid, { image: buffer, caption: "" }, { quoted: msg });
    } catch (err) {
      return reply(`❌ Gagal membuat iqc: ${err.message}`);
    }
  },
};
