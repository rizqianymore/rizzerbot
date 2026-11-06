import { askAI, getAIStatus, normalizeSource } from "@/src/services/ai/router.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";

const MODEL_FLAGS = [
  "--r1",
  "--deepseek",
  "--ds",
  "--duckai",
  "--duck",
  "--scrape",
  "--gemini",
  "--gm",
  "--groq",
  "--gq",
  "--opencode",
  "--oc",
  "--zen",
  "--cerebras",
  "--cb",
  "--mistral",
  "--mis",
  "--openrouter",
  "--or",
  "--github",
  "--gh",
  "--nvidia",
  "--nv",
  "--polli",
  "--pl",
];

export default {
  name: "ai",
  aliases: ["tanya", "chatai", "ask"],
  description: "Tanya AI dengan format model pilihan dan pertanyaan teks",
  usage: "[model] <pertanyaan> | contoh: .ai r1 jelaskan gravitasi",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const p = prefix || ".";

    if (!args || args.length === 0) {
      return reply(
        `*CARA PENGGUNAAN AI*\n\n` +
          `Format:\n` +
          `• *${p}ai <pertanyaan>*\n` +
          `• *${p}ai <model> <pertanyaan>*\n\n` +
          `Pilihan Model Populer:\n` +
          `• *r1* / *deepseek* : DeepSeek R1 Reasoning (Gratis Scrape)\n` +
          `• *duckai* : DuckAI Web (Gratis Scrape)\n` +
          `• *opencode* / *oc* : OpenCode Zen (Free Coding Models)\n` +
          `• *gemini* : Google Gemini AI\n` +
          `• *groq* : Groq Llama Ultra-Fast\n\n` +
          `Contoh:\n` +
          `• *${p}ai r1 Buatkan kode async retry di JavaScript*\n` +
          `• *${p}ai Siapakah presiden pertama Indonesia?*\n` +
          `• *${p}ai --models* (Cek status semua provider)`
      );
    }

    const firstWord = (args[0] || "").toLowerCase();

    if (firstWord === "--models" || firstWord === "-m" || firstWord === "--status" || firstWord === "models") {
      try {
        const s = getAIStatus();
        return reply(
          `*STATUS AI PROVIDERS*\n\n` +
            Object.entries(s)
              .map(([k, v]) => `• *${k.toUpperCase()}*: ${v}`)
              .join("\n")
        );
      } catch (err) {
        return reply(`*STATUS GAGAL*\n${err?.message || "error"}`);
      }
    }

    let prefer = null;
    let queryArgs = [...args];

    // 1. Cek apakah kata pertama adalah nama model langsung (misal: .ai r1 ..., .ai deepseek ..., .ai opencode ...)
    const cleanFirst = firstWord.replace(/^--/, "");
    const recognizedFirst = normalizeSource(cleanFirst);

    if (recognizedFirst && args.length > 1) {
      prefer = recognizedFirst;
      queryArgs.shift(); // Buang kata pertama karena itu nama model
    } else {
      // 2. Cek apakah ada flag --model di tengah teks
      let fullText = args.join(" ").trim();
      for (const flag of MODEL_FLAGS) {
        if (fullText.toLowerCase().includes(flag)) {
          prefer = normalizeSource(flag.replace(/^--/, ""));
          fullText = fullText.replace(new RegExp(flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").trim();
          break;
        }
      }
      queryArgs = fullText.split(/\s+/).filter(Boolean);
    }

    const promptText = queryArgs.join(" ").trim();
    if (!promptText) {
      return reply(`Silakan tuliskan teks pertanyaan setelah model! Contoh:\n*${p}ai ${prefer || "r1"} Halo apa kabar?*`);
    }

    await reply("Memproses jawaban...");
    try {
      const history = getHistory(senderJid);
      const result = await askAI(promptText, { prefer, history });
      pushTurn(senderJid, promptText, result.text);

      const header = `*AI (${result.model || result.source.toUpperCase()})*`;
      const output = `${header}\n\n${result.text}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*AI ERROR*\n${err?.message || "Terjadi kesalahan saat memproses jawaban."}`);
    }
  },
};
