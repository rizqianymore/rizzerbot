import { ClaudeHaiku } from "@/src/services/ai/overchat.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";

export default {
  name: "claudehaiku",
  aliases: ["claude", "haiku", "chiku"],
  description: "Chat dengan Claude Haiku 4.5 via OverChat",
  usage: "<pertanyaan>",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();

    const text = args.join(" ").trim();
    if (!text) {
      return reply(
        `*CLAUDE HAIKU*\n\n` +
          `Penggunaan: *${prefix}claudehaiku <pertanyaan>*\n` +
          `Contoh: *${prefix}claudehaiku Jelaskan teori relativitas*`
      );
    }

    try {
      const result = await ClaudeHaiku(text, { history: getHistory(senderJid) });

      if (!result.status) {
return reply(`*CLAUDE HAIKU GAGAL*\n${result.error || "Gagal mendapatkan respons"}`);
      }
      pushTurn(senderJid, text, result.answer);
const answer = `${result.answer}`;
      await reply(answer.length > 4000 ? answer.slice(0, 4000) + "..." : answer);
    } catch (err) {
reply(`*CLAUDE HAIKU GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
