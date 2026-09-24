import { askDeepSeek } from "@/src/services/ai-gateway.js";

export default [
  {
    name: "deepseek",
    aliases: ["ds", "deepseekai", "r1"],
    description: "Tanya AI DeepSeek (mendukung mode penalaran DeepSeek-R1)",
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
