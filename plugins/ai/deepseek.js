// plugins/ai/deepseek.js — perintah "deepseek" (1 file = 1 perintah, dipecah dari ai.js).
import { askDeepSeek } from '@/src/services/ai-gateway.js';

export default {
  "name": "deepseek",
  "aliases": ["ds","deepseekai","r1"],
  "description": "Tanya AI DeepSeek (mendukung mode penalaran DeepSeek-R1)",
  "usage": "<pertanyaan> [--think / --search]",
  "premiumOnly": true,
  "category": "AI",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const p = prefix || ".";

      let text = args.join(" ").trim();
      if (!text) {
        return reply(
          `*DEEPSEEK AI*\n\n` +
          `Penggunaan:\n` +
          `*${p}deepseek [pertanyaan]* (mode standar)\n` +
          `*${p}deepseek --think [pertanyaan]* (mode penalaran)\n` +
          `*${p}deepseek --search [pertanyaan]* (mode web)\n\n` +
          `Contoh: *${p}deepseek Jelaskan quantum computing*`
        );
      }

      let thinking = false;
      let search = false;

      // Deteksi flag --think atau --r1
      if (text.includes("--think") || text.includes("--r1") || text.includes("-r1")) {
        thinking = true;
        text = text.replace(/--think|--r1|-r1/gi, "").trim();
      }

      // Deteksi flag --search
      if (text.includes("--search") || text.includes("-s")) {
        search = true;
        text = text.replace(/--search|-s/gi, "").trim();
      }

      if (!text) {
        return reply("Masukkan pertanyaan setelah flag!");
      }

      await reply(
        thinking
          ? "Menganalisis dengan DeepSeek-R1..."
          : "Memproses jawaban..."
      );

      try {
        const result = await askDeepSeek(text, { thinking, search });

        let output = `*DEEPSEEK AI*${result.thinkingEnabled ? " (R1)" : ""}\n\n`;

        if (result.reasoning) {
          const trimmedReasoning =
            result.reasoning.length > 800
              ? `${result.reasoning.slice(0, 800)}...`
              : result.reasoning;

          output += `Penalaran:\n${trimmedReasoning}\n\n`;
        }

        output += `${result.answer}`;

        if (result.isFallback) {
          output += `\n\n(Via gateway publik)`;
        }

        await reply(output.slice(0, 4000));
      } catch (err) {
        await reply(`*DEEPSEEK AI GAGAL*\n${err.message}`);
      }
    },
};
