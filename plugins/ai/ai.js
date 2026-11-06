import { askAI, getAIStatus, normalizeSource } from "@/src/services/ai/router.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";

export default {
  name: "ai",
  aliases: ["tanya", "chatai", "ask"],
  description: "Tanya AI cerdas 100% Free Web Scraped (Tanpa API Key)",
  usage: "[model] <pertanyaan> | contoh: .ai r1 jelaskan black hole",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const p = prefix || ".";

    if (!args || args.length === 0) {
      return reply(
        `*AI ENGINE (100% BEBAS API KEY)*\n\n` +
          `Format:\n` +
          `• *${p}ai <pertanyaan>*\n` +
          `• *${p}ai <model> <pertanyaan>*\n\n` +
          `Daftar Model Non-API Key:\n` +
          `• *r1* / *deepseek* : DeepSeek R1 Reasoning (Web Scraped)\n` +
          `• *duckai* : DuckAI Web Intelligence\n` +
          `• *opencode* / *oc* : OpenCode Zen Free Coding Engine\n` +
          `• *meta* / *llama* : Meta Llama 3 Web\n` +
          `• *pollinations* : Pollinations Public Node\n\n` +
          `Contoh:\n` +
          `• *${p}ai r1 Buatkan kode async crawler di Node.js*\n` +
          `• *${p}ai Siapakah penemu komputer?*\n` +
          `• *${p}ai models* (Cek status model aktif)`
      );
    }

    const firstWord = (args[0] || "").toLowerCase().replace(/^--/, "");

    if (firstWord === "models" || firstWord === "status" || firstWord === "-m") {
      const s = getAIStatus();
      return reply(
        `*STATUS MODEL AI (NON-API KEY)*\n\n` +
          Object.entries(s)
            .map(([k, v]) => `• *${k.toUpperCase()}*: ${v}`)
            .join("\n")
      );
    }

    let prefer = null;
    let queryArgs = [...args];

    // Cek apakah argumen pertama adalah nama model
    const matchedModel = normalizeSource(firstWord);
    if (matchedModel && args.length > 1) {
      prefer = matchedModel;
      queryArgs.shift();
    }

    const promptText = queryArgs.join(" ").trim();
    if (!promptText) {
      return reply(`Silakan tulis pertanyaan kamu setelah model! Contoh:\n*${p}ai ${prefer || "r1"} Halo apa kabar?*`);
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
