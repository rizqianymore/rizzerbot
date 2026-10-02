// plugins/ai/claudehaiku.js — perintah "claudehaiku" (1 file = 1 perintah).
import { ClaudeHaiku } from "@/src/services/overchat.js";

export default {
  "name": "claudehaiku",
  "aliases": ["claude","haiku","chiku"],
  "description": "Chat dengan Claude Haiku 4.5 via OverChat",
  "usage": "<pertanyaan>",
  "premiumOnly": true,
  "category": "AI",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();

    const text = args.join(" ").trim();
    if (!text) {
      return reply(
        `*CLAUDE HAIKU*\n\n` +
        `Penggunaan: *${prefix}claudehaiku <pertanyaan>*\n` +
        `Contoh: *${prefix}claudehaiku Jelaskan teori relativitas*`
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
          `*CLAUDE HAIKU GAGAL*\n${result.error || "Gagal mendapatkan respons"}`
        );
      }

      await react("✅");

      const answer = `${result.answer}`;
      await reply(answer.length > 4000 ? answer.slice(0, 4000) + "..." : answer);
    } catch (err) {
      await react("☢");
      reply(`*CLAUDE HAIKU GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
