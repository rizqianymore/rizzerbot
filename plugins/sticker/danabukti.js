import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createSticker } from "@/src/services/fetch/media.js";

const TEMPLATE_BLANK = path.join(process.cwd(), "assets", "maker", "dana_template_blank.png");
const TEMPLATE_NOMINAL = path.join(process.cwd(), "assets", "maker", "dana_template_nominal.png");

let cachedBlank = null;
let cachedNominal = null;

async function getTemplates() {
  if (!cachedBlank && fs.existsSync(TEMPLATE_BLANK)) {
    cachedBlank = await loadImage(TEMPLATE_BLANK);
  }
  if (!cachedNominal && fs.existsSync(TEMPLATE_NOMINAL)) {
    cachedNominal = await loadImage(TEMPLATE_NOMINAL);
  }
  return { blank: cachedBlank, nominal: cachedNominal };
}

function formatRupiah(val) {
  const digits = String(val || "").replace(/[^0-9]/g, "");
  if (digits) {
    return `Rp${Number(digits).toLocaleString("id-ID")}`;
  }
  const trimmed = String(val || "").trim();
  if (!trimmed) return "Rp0";
  return trimmed.toLowerCase().startsWith("rp") ? trimmed : `Rp${trimmed}`;
}

export default {
  name: "danabukti",
  aliases: ["sdana", "danafake", "danamaker", "stikerdana"],
  description: "Buat stiker / gambar bukti pembayaran sukses DANA custom nominal & tujuan",
  usage: "<nominal> [| nama tujuan | bank / keterangan]",
  category: "Sticker",
  cooldownMs: 5000,

  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    const rawInput = args.join(" ").trim();

    if (!rawInput) {
      return reply(
        `┌── PEMBUAT STIKER BUKTI DANA\n` +
          `│ Buat stiker bukti transfer DANA sukses custom nominal.\n` +
          `└──\n\n` +
          `├── [1] Tanpa Nama (Nominal Saja)\n` +
          `│   Format: ${p}danabukti <nominal>\n` +
          `│   Contoh: ${p}danabukti 50000\n` +
          `│   Contoh: ${p}danabukti 3.190.000\n` +
          `│\n` +
          `└── [2] Custom Nama & Rekening\n` +
          `    Format: ${p}danabukti <nominal> | <nama> | [bank]\n` +
          `    Contoh: ${p}danabukti 100000 | Rizzer Store | BCA - 123456`
      );
    }

    await sendTyping();

    const parts = rawInput.split("|").map((s) => s.trim());
    const nominalRaw = parts[0] || "";
    const recipientRaw = parts[1] || "";
    const bankRaw = parts[2] || "";

    const nominalText = formatRupiah(nominalRaw);

    try {
      const { blank, nominal: nominalBg } = await getTemplates();
      if (!blank || !nominalBg) {
        return reply("❌ Template DANA tidak ditemukan di server.");
      }

      const isCustomRecipient = Boolean(recipientRaw);
      const bg = isCustomRecipient ? blank : blank;

      const canvas = createCanvas(bg.width, bg.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bg, 0, 0);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const centerX = bg.width / 2;

      if (isCustomRecipient) {

        ctx.font = "bold 20px 'Liberation Sans', sans-serif";
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.fillText(recipientRaw.toUpperCase(), centerX, 440);

        if (bankRaw) {
          ctx.font = "16px 'Liberation Sans', sans-serif";
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.fillText(bankRaw, centerX, 470);
        }

        ctx.font = "bold 44px 'Liberation Sans', sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(nominalText, centerX, bankRaw ? 570 : 540);
      } else {

        ctx.font = "bold 48px 'Liberation Sans', sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(nominalText, centerX, 520);
      }

      const pngBuffer = canvas.toBuffer("image/png");
      const stickerBuffer = await createSticker(pngBuffer, {
        packName: process.env.STICKER_PACK_NAME || "Rizzer Bot",
        authorName: process.env.STICKER_AUTHOR || "DANA Payment",
      });

      const chatId = msg.key.remoteJid;
      return await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: msg });
    } catch (err) {
      return reply(`❌ Gagal membuat stiker DANA: ${err.message}`);
    }
  },
};
