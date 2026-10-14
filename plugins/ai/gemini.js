import { askGemini } from "@/src/services/ai/gemini.js";

export default {
  name: "gemini",
  aliases: ["gm", "geminiai"],
  description: "Chat dengan Google Gemini (butuh GEMINI_API_KEY di .env)",
  usage: "<pertanyaan>",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const text = args.join(" ").trim();
    if (!text) {
      return reply(
        `*GEMINI AI*\n\n` +
          `Penggunaan: *${prefix}gemini <pertanyaan>*\n` +
          `Contoh: *${prefix}gemini Buatkan ide konten 7 hari*\n\n` +
          `Butuh GEMINI_API_KEY di .env (https://aistudio.google.com/apikey)`
      );
    }
    try {
      const result = await askGemini(text);
      const output = `*GEMINI AI (${result.model})*\n\n${result.text}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*GEMINI GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
