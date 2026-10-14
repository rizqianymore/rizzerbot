import { askAI, getAIStatus, normalizeSource } from "@/src/services/ai/router.js";

const FLAGS = ["--gemini", "--gm", "--groq", "--gq", "--or", "--openrouter", "--ddg", "--duck", "--polli", "--pl", "--claude", "--ch"];

export default {
  name: "ai",
  aliases: ["gpt", "tanya", "chatai"],
  description: "Tanya AI gratis (auto fallback antar provider, tanpa key tetap jalan)",
  usage: "<pertanyaan> [--groq/--gemini/--or/--ddg/--polli/--claude] | --models",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const p = prefix || ".";
    let text = args.join(" ").trim();
    if (!text) {
      return reply(
        `*AI*\n\n` +
          `Penggunaan:\n` +
          `*${p}ai [pertanyaan]* (otomatis, tanpa key tetap jalan)\n` +
          `*${p}ai --groq / --gemini / --or / --ddg / --polli / --claude [pertanyaan]*\n` +
          `*${p}ai --models* (cek provider yang aktif)\n\n` +
          `Contoh: *${p}ai Jelaskan black hole dengan sederhana*`
      );
    }

    if (text === "--models" || text === "-m") {
      try {
        const s = await getAIStatus();
        return reply(
          `*STATUS PROVIDER AI*\n\n` +
            Object.entries(s)
              .map(([k, v]) => `• ${k}: ${v}`)
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
    if (!text) return reply("Masukkan pertanyaan setelah flag!");

    await reply("Memproses jawaban...");
    try {
      const result = await askAI(text, { prefer });
      const output = `*AI (${result.source})*\n\n${result.text}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*AI GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
