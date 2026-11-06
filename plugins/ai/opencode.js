import { askOpenCode } from "@/src/services/ai/opencode.js";
import { getHistory, pushTurn } from "@/src/services/ai/memory.js";

export default {
  name: "opencode",
  aliases: ["oc", "opencodeai", "zenai"],
  description: "Chat dengan AI OpenCode Zen (Coding & Reasoning frontier model)",
  usage: "<pertanyaan>",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    await sendTyping();
    const text = args.join(" ").trim();
    if (!text) {
      return reply(
        `*OPENCODE ZEN AI*\n\n` +
          `Format: *${prefix}opencode <pertanyaan>*\n` +
          `Contoh: *${prefix}opencode Buatkan fungsi async retry di Node.js*\n\n` +
          `Catatan: Menggunakan endpoint OpenCode Zen API (mendukung OPENCODE_API_KEY di config/settings.js)`
      );
    }

    await reply("Menghubungi OpenCode AI...");
    try {
      const history = getHistory(senderJid);
      const result = await askOpenCode(text, { history });
      pushTurn(senderJid, text, result.text);

      const output = `*OPENCODE AI (${result.model})*\n\n${result.text}`;
      await reply(output.slice(0, 4000));
    } catch (err) {
      await reply(`*OPENCODE GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
