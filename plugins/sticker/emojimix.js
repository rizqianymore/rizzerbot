import axios from "axios";
import { requireCanvas } from "@/src/utils/native.js";
import { createSticker } from "@/src/services/fetch/media.js";

function emojiCodepoints(emoji) {
  const points = [];
  for (const ch of String(emoji || "")) {
    const cp = ch.codePointAt(0).toString(16);
    if (cp === "fe0f") continue;
    points.push(cp);
  }
  return points.join("-");
}

function splitEmoji(text) {
  const parts = [];
  try {
    const seg = new Intl.Segmenter("id", { granularity: "grapheme" });
    for (const { segment } of seg.segment(text)) {
      if (segment.trim()) parts.push(segment);
    }
  } catch (_) {
    parts.push(...String(text || "").split("").filter((c) => c.trim()));
  }
  return parts.filter((p) => /\p{Extended_Pictographic}/u.test(p));
}

async function fetchTwemoji(codepoints) {
  const res = await axios.get(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoints}.png`, {
    responseType: "arraybuffer",
    timeout: 15000,
  });
  const buf = Buffer.from(res.data);
  if (buf.length < 100 || buf.slice(0, 4).toString("hex") !== "89504e47") throw new Error("gambar emoji rusak");
  return buf;
}

export default {
  name: "emojimix",
  aliases: ["mixemoji", "emix"],
  description: "Gabung 2 emoji jadi stiker",
  usage: "<emoji1>+<emoji2>",
  category: "Sticker",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const raw = args.join(" ").trim();
    const cleaned = raw.replace(/\s*\+\s*/g, "+");
    const pair = cleaned.includes("+") ? cleaned.split("+") : splitEmoji(raw);
    const emojis = pair.map((e) => String(e || "").trim()).filter(Boolean);
    if (emojis.length !== 2) {
      return reply(
        `*EMOJIMIX*\n\nKirim 2 emoji: ${prefix || "."}emojimix 😀+😎\natau: ${prefix || "."}emojimix 😀 😎`
      );
    }
    const codes = emojis.map(emojiCodepoints);
    if (codes.some((c) => !c)) return reply("Emoji tidak dikenali, coba emoji lain.");
    await sendTyping();
    try {
      const { createCanvas, loadImage } = requireCanvas();
      const [left, right] = await Promise.all(codes.map(fetchTwemoji));
      const size = 512;
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(await loadImage(left), size * 0.06, size * 0.22, size * 0.44, size * 0.44);
      ctx.drawImage(await loadImage(right), size * 0.5, size * 0.34, size * 0.44, size * 0.44);
      const png = Buffer.from(await canvas.encode("png"));
      const stickerBuffer = await createSticker(png, {});
      await sock.sendMessage(msg.key.remoteJid, { sticker: stickerBuffer, mimetype: "image/webp" }, { quoted: msg });
    } catch (err) {
      return reply(`Gagal membuat emojimix: ${err?.message || "coba lagi"}`);
    }
  },
};
