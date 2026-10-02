// plugins/sports/f1circuits.js — sirkuit F1 (f1api.dev).
import { searchCircuits, getCircuitById, fmtCircuit, replyDetail } from "@/src/services/f1.js";

export default {
  name: "f1circuits",
  aliases: ["f1circuit", "f1sirkuit", "circuits"],
  description: "Cari/list sirkuit F1: monza, spa, suzuka, dst (sumber: f1api.dev)",
  usage: "[nama/id sirkuit, cth: monza]",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const query = (args || []).join(" ").trim();
    await sendTyping();
    try {
      if (!query) {
        const list = await searchCircuits("", 10);
        let text = `🔄 *DAFTAR SIRKUIT F1 (10 pertama)*\n\n`;
        list.forEach((c, i) => {
          text += `${i + 1}. *${c.circuitName}* (\`${c.circuitId}\`) — ${c.city || "-"}, ${c.country || "-"}\n`;
        });
        text += `\n💡 Cari: \`${currentPrefix}f1circuits monza\``;
        return reply(text.trim());
      }
      if (/^[a-z0-9_]+$/i.test(query) && !query.includes(" ")) {
        try {
          const c = await getCircuitById(query);
          return replyDetail(sock, msg, reply, fmtCircuit(c), c.url);
        } catch (_) {}
      }
      const hits = await searchCircuits(query, 10);
      if (!hits.length) return reply(`❌ Sirkuit "${query}" tidak ditemukan.\nCoba: \`${currentPrefix}f1circuits monza\``);
      if (hits.length === 1) return replyDetail(sock, msg, reply, fmtCircuit(hits[0]), hits[0].url);
      let text = `🔄 *HASIL "${query}" (${hits.length})*\n\n`;
      hits.forEach((c, i) => {
        text += `${i + 1}. *${c.circuitName}* (\`${c.circuitId}\`) — ${c.country || "-"}\n`;
      });
      text += `\n💡 Detail: \`${currentPrefix}f1circuits <circuitId>\``;
      return reply(text.trim());
    } catch (err) {
      return reply(`❌ Gagal memuat data sirkuit: ${err.message}`);
    }
  },
};
