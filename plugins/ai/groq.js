import { askGroq } from "@/src/services/ai/groq.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";

export default {
  name: "groq",
  aliases: ["gq", "groqai", "llama"],
  description: "Chat super cepat dengan Groq LPU (Llama-3.3 70B)",
  usage: "<pertanyaan>",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const text = args.join(" ").trim();
    if (!text) {
      return reply(
        `*GROQ AI (ULTRA-FAST)*\n\n` +
          `Format: *${prefix}groq <pertanyaan>*\n` +
          `Contoh: *${prefix}groq Buatkan kode Python untuk web scraper*\n\n` +
          `Catatan: Membutuhkan GROQ_API_KEY di config/settings.js`
      );
    }

    await reply("Menghubungi Groq AI...");
    try {
      const history = getHistory(senderJid);
      const result = await askGroq(text, { history });
      pushTurn(senderJid, text, result.text);

      const output = `*GROQ AI (${result.model})*\n\n${result.text}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*GROQ GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
