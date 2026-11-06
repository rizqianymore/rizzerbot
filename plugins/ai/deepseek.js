import { askDeepSeek } from "@/src/services/ai/deepseek.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";

export default {
  name: "deepseek",
  aliases: ["ds", "deepseekai", "r1"],
  description: "Chat langsung dengan DeepSeek R1 Web Scraped (Tanpa API Key)",
  usage: "<pertanyaan>",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const p = prefix || ".";
    let text = args.join(" ").trim();

    if (!text) {
      return reply(
        `*DEEPSEEK R1 (NON-API KEY)*\n\n` +
          `Format: *${p}deepseek <pertanyaan>*\n` +
          `Contoh: *${p}deepseek Jelaskan paradoks Fermi*\n\n` +
          `100% menggunakan engine web scraping live tanpa memerlukan API key.`
      );
    }

    await reply("Menganalisis dengan DeepSeek R1...");
    try {
      const history = getHistory(senderJid);
      const result = await askDeepSeek(text, { history });
      pushTurn(senderJid, text, result.text);

      const output = `*DEEPSEEK R1 (${result.model})*\n\n${result.text}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*DEEPSEEK GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
