// plugins/ai/claudehaiku.js — perintah "claudehaiku" (1 file = 1 perintah).
import { ClaudeHaiku } from "@/src/services/overchat.js";

export default {
  "name": "claudehaiku",
  "aliases": ["claude","haiku","chiku"],
  "description": "Chat dengan Claude Haiku 4.5 via OverChat",
  "premiumOnly": false,
  "category": "AI",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();

    const text = args.join(" ").trim();
    if (!text) {
      return reply(
        `🤍 *Claude Haiku 4.5*\n\n` +
        `Tanya apa aja ke AI Claude Haiku — cepat dan ringan, cocok buat pertanyaan sehari-hari.\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${prefix}claudehaiku <pertanyaan>*\n\n` +
        `*CONTOH:*\n` +
        `> *${prefix}claudehaiku Jelaskan teori relativitas*\n` +
        `> *${prefix}claudehaiku Tips biar produktif*\n\n` +
        `_Respons cepat, tapi tetap cerdas_`
      );
    }

    const react = (emoji) =>
      sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});
    await react("🕕");

    try {
      const result = await ClaudeHaiku(text);

      if (!result.status) {
        await react("☢");
        return reply(
          `❌ *Claude Haiku Gagal*\n\n> ${result.error || "Gagal mendapatkan respons"}`
        );
      }

      await react("✅");

      const answer = `${result.answer}`;
      await reply(answer.length > 4000 ? answer.slice(0, 4000) + "..." : answer);
    } catch (err) {
      await react("☢");
      reply(`❌ *Claude Haiku Gagal*\n\n> ${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
