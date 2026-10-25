import { createHelloKittyImage } from "@/src/services/fetch/hellokitty.js";
import { sendStickerBuffer, validateBratText } from "@/src/services/fetch/brat.js";

export default {
  name: "hellokitty",
  cooldownMs: 5000,
  aliases: ["hk", "kitty"],
  description: "Membuat sticker karakter Hello Kitty dengan teks kustom",
  category: "Sticker",
  usage: "<teks>",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    const p = prefix || ".";
    const text = args.join(" ").trim();

    if (!text) {
      return reply(
        `*HELLO KITTY STICKER*\n\n` +
          `• \`${p}hellokitty <teks>\`\n` +
          `• \`${p}hk <teks>\`\n\n` +
          `Contoh:\n` +
          `\`${p}hk selamat pagi semua\``
      );
    }

    const check = validateBratText(text, false);
    if (!check.ok) return reply(check.error);

    // Indikator reaksi & typing untuk respon instan
    Promise.resolve(
      sock.sendMessage(msg.key.remoteJid, {
        react: { text: "🎀", key: msg.key },
      })
    ).catch(() => {});
    await sendTyping();

    try {
      const image = await createHelloKittyImage(text);
      await sendStickerBuffer(sock, msg, image);

      // Indikator selesai
      Promise.resolve(
        sock.sendMessage(msg.key.remoteJid, {
          react: { text: "✨", key: msg.key },
        })
      ).catch(() => {});
    } catch (err) {
      logger?.error?.(`[hellokitty] ${err?.stack || err?.message || err}`);
      Promise.resolve(
        sock.sendMessage(msg.key.remoteJid, {
          react: { text: "❌", key: msg.key },
        })
      ).catch(() => {});
      await reply(`Gagal membuat sticker Hello Kitty: ${err.message}`);
    }
  },
};
