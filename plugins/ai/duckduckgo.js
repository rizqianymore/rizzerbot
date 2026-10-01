// plugins/ai/duckduckgo.js — perintah "duckduckgo" (1 file = 1 perintah, dipecah dari ai.js).
import { askDuckDuckGo, getLiveFreeModels } from '@/src/services/duckduckgo/client.js';

export default {
  "name": "duckduckgo",
  "aliases": ["ddg","duckai"],
  "description": "Tanya AI DuckDuckGo (GPT-5.4-mini, Claude-Haiku-4.5, Mistral-Small)",
  "usage": "<pertanyaan> [--claude / --mistral]",
  "premiumOnly": false,
  "category": "AI",
  "run": async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const p = prefix || ".";

      let text = args.join(" ").trim();
      if (!text) {
        return reply(
          `*DUCKDUCKGO AI*\n\n` +
          `Penggunaan:\n` +
          `*${p}ddg [pertanyaan]* (default)\n` +
          `*${p}ddg --claude [pertanyaan]*\n` +
          `*${p}ddg --mistral [pertanyaan]*\n` +
          `*${p}ddg --models* (daftar model)\n\n` +
          `Contoh: *${p}ddg Buatkan puisi tentang senja*`
        );
      }

      if (text === "--models" || text === "-m") {
        try {
          const liveIds = await getLiveFreeModels();
          const list = liveIds ? Array.from(liveIds).join("\n") : "gpt-5.4-mini\nclaude-haiku-4-5\nmistral-small-2603";
          return reply(`*MODEL DUCKDUCKGO*\n\n${list}`);
        } catch (err) {
          return reply(`*MODEL DUCKDUCKGO GAGAL*\n${err.message}`);
        }
      }

      let selectedModel = "gpt-5.4-mini";

      if (text.includes("--claude") || text.includes("-c")) {
        selectedModel = "claude-haiku-4-5";
        text = text.replace(/--claude|-c/gi, "").trim();
      } else if (text.includes("--mistral") || text.includes("-m")) {
        selectedModel = "mistral-small-2603";
        text = text.replace(/--mistral|-m/gi, "").trim();
      } else if (text.includes("--gpt") || text.includes("-g")) {
        selectedModel = "gpt-5.4-mini";
        text = text.replace(/--gpt|-g/gi, "").trim();
      }

      if (!text) {
        return reply("Masukkan pertanyaan setelah model flag!");
      }

      await reply(`Memproses jawaban via ${selectedModel}...`);

      try {
        const result = await askDuckDuckGo(text, { model: selectedModel });
        const output = `*DUCKDUCKGO AI (${result.model})*\n\n${result.text}`;
        await reply(output.slice(0, 4000));
      } catch (err) {
        await reply(`*DUCKDUCKGO AI GAGAL*\n${err.message}`);
      }
    },
};
