import { askGemini } from "@/src/services/ai/gemini.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";

export default {
  name: "gemini",
  aliases: ["gm", "geminiai", "bard"],
  description: "Chat langsung dengan Google Gemini AI resmi",
  usage: "<pertanyaan>",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const text = args.join(" ").trim();
    if (!text) {
      return reply(
        `*GOOGLE GEMINI AI*\n\n` +
          `Format: *${prefix}gemini <pertanyaan>*\n` +
          `Contoh: *${prefix}gemini Buatkan itinerary liburan 3 hari ke Bali*\n\n` +
          `Catatan: Membutuhkan GEMINI_API_KEY di config/settings.js`
      );
    }

    await reply("Menghubungi Gemini AI...");
    try {
      const history = getHistory(senderJid);
      const result = await askGemini(text, { history });
      pushTurn(senderJid, text, result.text);

      const output = `*GEMINI AI (${result.model})*\n\n${result.text}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*GEMINI GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
