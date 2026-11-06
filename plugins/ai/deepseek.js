import { askDeepSeek } from "@/src/services/ai/deepseek.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";

export default {
  name: "deepseek",
  aliases: ["ds", "deepseekai", "r1"],
  description: "Chat langsung dengan DeepSeek (mendukung model penalaran R1)",
  usage: "<pertanyaan> [--r1 / --think]",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const p = prefix || ".";
    let text = args.join(" ").trim();

    if (!text) {
      return reply(
        `*DEEPSEEK AI*\n\n` +
          `Format Penggunaan:\n` +
          `• *${p}deepseek <pertanyaan>* (Mode DeepSeek-V3 Chat)\n` +
          `• *${p}deepseek --r1 <pertanyaan>* (Mode DeepSeek-R1 Reasoning)\n\n` +
          `Contoh: *${p}deepseek --r1 Selesaikan teka-teki logika ini...*\n\n` +
          `Catatan: Membutuhkan DEEPSEEK_API_KEY di config/settings.js`
      );
    }

    let thinking = false;
    if (text.includes("--r1") || text.includes("--think") || text.includes("-r1")) {
      thinking = true;
      text = text.replace(/--r1|--think|-r1/gi, "").trim();
    }

    if (!text) return reply("Silakan masukkan pertanyaan setelah flag --r1!");

    await reply(thinking ? "Menganalisis dengan DeepSeek-R1..." : "Memproses jawaban DeepSeek...");
    try {
      const history = getHistory(senderJid);
      const result = await askDeepSeek(text, { thinking, history });
      pushTurn(senderJid, text, result.text);

      const output = `*DEEPSEEK AI (${result.model})*\n\n${result.text}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*DEEPSEEK GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
