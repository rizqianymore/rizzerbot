import { askDuckDuckGo, getLiveFreeModels } from "@/src/services/duckduckgo/client.js";

export default [
  {
    name: "duckduckgo",
    aliases: ["ddg", "duckai", "claude"],
    description: "Tanya AI DuckDuckGo (GPT-5.4-mini, Claude-Haiku-4.5, Mistral-Small)",
    premiumOnly: false,
    category: "AI",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();

      let text = args.join(" ").trim();
      if (!text) {
        return reply(
          `🦆 *Panduan Penggunaan DuckDuckGo AI*\n\n` +
          `• *.ddg [pertanyaan]*\n  _Model default (GPT-5.4-mini)_\n\n` +
          `• *.ddg --claude [pertanyaan]*\n  _Gunakan Claude Haiku 4.5_\n\n` +
          `• *.ddg --mistral [pertanyaan]*\n  _Gunakan Mistral Small 4_\n\n` +
          `• *.ddg --models*\n  _Lihat daftar model gratis yang tersedia_\n\n` +
          `💡 *Contoh:*\n` +
          `*.ddg Buatkan puisi tentang senja*\n` +
          `*.ddg --claude Jelaskan teori relativitas secara ringkas*`
        );
      }

      if (text === "--models" || text === "-m") {
        try {
          const liveIds = await getLiveFreeModels();
          const list = liveIds ? Array.from(liveIds).join("\n• ") : "gpt-5.4-mini\n• claude-haiku-4-5\n• mistral-small-2603";
          return reply(`📋 *Daftar Model Gratis DuckDuckGo:*\n\n• ${list}`);
        } catch (err) {
          return reply(`❌ Gagal mengambil daftar model: ${err.message}`);
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
        return reply("❌ Masukkan pertanyaan setelah model flag!");
      }

      await reply(`🦆 *DuckDuckGo AI* sedang memproses jawaban via *${selectedModel}*...`);

      try {
        const result = await askDuckDuckGo(text, { model: selectedModel });
        const output = `🦆 *DuckDuckGo AI* _(${result.model})_\n\n${result.text}`;
        await reply(output.slice(0, 4000));
      } catch (err) {
        await reply(`❌ Gagal mendapatkan jawaban dari DuckDuckGo: ${err.message}`);
      }
    },
  },
];
