import { getHistory, clearHistory, memoryStats } from "@/src/services/ai/memory.js";
import { cacheClear } from "@/src/services/ai/cache.js";

export default {
  name: "lupa",
  aliases: ["forget", "resetai", "lupain"],
  description: "Hapus riwayat obrolan AI kamu dan cache jawaban",
  usage: "[--cache]",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, senderJid }) => {
    await sendTyping();
    const wantCache = (args || []).some((a) => String(a).toLowerCase().includes("cache"));
    const hadHistory = getHistory(senderJid).length > 0;
    clearHistory(senderJid);
    const purged = wantCache ? cacheClear() : 0;
    const m = memoryStats();

    const lines = [hadHistory ? "Riwayat AI kamu direset." : "Belum ada riwayat percakapan aktif."];
    if (wantCache) lines.push(`Cache jawaban dibersihkan (${purged} entri).`);
    lines.push(`Memori aktif: ${m.buckets} bucket / ${m.turns} turn.`);
    return reply(`*RESET AI*\n\n${lines.join("\n")}`);
  },
};
