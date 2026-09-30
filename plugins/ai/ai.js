import { askDuckDuckGo, getLiveFreeModels } from "@/src/services/duckduckgo/client.js";
import { askDeepSeek } from "@/src/services/ai-gateway.js";

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

  {
    name: "deepseek",
    aliases: ["ds", "deepseekai", "r1"],
    description: "Tanya AI DeepSeek (mendukung mode penalaran DeepSeek-R1)",
    premiumOnly: true,
    category: "AI",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();

      let text = args.join(" ").trim();
      if (!text) {
        return reply(
          `🧠 *Panduan Pengunaan Deepseek AI*\n\n` +
          `• *.deepseek [pertanyaan]*\n  _Mode chat standar (DeepSeek-V3)_\n\n` +
          `• *.deepseek --think [pertanyaan]*\n  _Mode penalaran mendalam (DeepSeek-R1)_\n\n` +
          `• *.deepseek --search [pertanyaan]*\n  _Mode pencarian web terkini_\n\n` +
          `💡 *Contoh:*\n` +
          `*.deepseek Jelaskan konsep quantum computing*\n` +
          `*.deepseek --think Analisis kompleksitas algoritma binary search*`
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
        return reply("❌ Masukkan pertanyaan setelah flag!");
      }

      await reply(
        thinking
          ? "🧠 *DeepSeek-R1* sedang menganalisis & bernalar..."
          : "💭 *DeepSeek* sedang memproses jawaban..."
      );

      try {
        const result = await askDeepSeek(text, { thinking, search });

        let output = `🤖 *DeepSeek AI* ${result.thinkingEnabled ? "*(R1 Reasoning)*" : ""}\n\n`;

        if (result.reasoning) {
          const trimmedReasoning =
            result.reasoning.length > 800
              ? `${result.reasoning.slice(0, 800)}... *(ringkasan)*`
              : result.reasoning;

          output += `💭 *Proses Berpikir (Chain of Thought):*\n_${trimmedReasoning}_\n\n───────────────────\n\n`;
        }

        output += `📝 *Jawaban:*\n${result.answer}`;

        if (result.isFallback) {
          output += `\n\n⚠️ _(Catatan: Berjalan via gateway publik. Untuk performa maksimal, pasang DEEPSEEK_COOKIE_TOKEN di .env)_`;
        }

        await reply(output.slice(0, 4000));
      } catch (err) {
        await reply(`❌ Gagal: ${err.message}`);
      }
    },
  },
];
