import { askAI, getAIStatus, normalizeSource } from "@/src/services/ai/router.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";

const FLAGS = [
  "--gemini",
  "--gm",
  "--groq",
  "--gq",
  "--deepseek",
  "--ds",
  "--r1",
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
  description: "Tanya AI cerdas dengan gateway multi-provider dan auto-fallback",
  usage: "<pertanyaan> [--gemini/--groq/--deepseek/--cerebras/--mistral/--openrouter/--github/--nvidia/--polli] | --models",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const p = prefix || ".";
    let text = args.join(" ").trim();

    if (!text) {
      return reply(
        `*AI GATEWAY MULTI-PROVIDER*\n\n` +
          `Format Penggunaan:\n` +
          `• *${p}ai <pertanyaan>* (Otomatis pilih provider tercepat & fallback)\n` +
          `• *${p}ai --gemini / --groq / --deepseek / --cerebras / --openrouter <pertanyaan>*\n` +
          `• *${p}ai --models* (Cek status konektivitas semua provider)\n` +
          `• *${p}lupa* (Reset riwayat obrolan AI kamu)\n\n` +
          `Contoh: *${p}ai Jelaskan konsep zero-knowledge proof secara sederhana*`
      );
    }

    if (text === "--models" || text === "-m" || text === "--status") {
      try {
        const s = getAIStatus();
        return reply(
          `*STATUS AI GATEWAY PROVIDERS*\n\n` +
            Object.entries(s)
              .map(([k, v]) => `• *${k.toUpperCase()}*: ${v}`)
              .join("\n")
        );
      } catch (err) {
        return reply(`*STATUS GAGAL*\n${err?.message || "error"}`);
      }
    }

    let prefer = null;
    for (const f of FLAGS) {
      if (text.includes(f)) {
        prefer = normalizeSource(f.replace(/^--/, ""));
        text = text.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").trim();
        break;
      }
    }

    if (!text) return reply("Silakan masukkan pertanyaan kamu setelah opsi flag.");

    await reply("Memproses jawaban...");
    try {
      const history = getHistory(senderJid);
      const result = await askAI(text, { prefer, history });
      pushTurn(senderJid, text, result.text);

      const header = `*AI (${result.source.toUpperCase()}${result.model ? ` / ${result.model}` : ""})*`;
      const output = `${header}\n\n${result.text}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*AI GATEWAY ERROR*\n${err?.message || "Terjadi kesalahan saat memproses jawaban."}`);
    }
  },
};
