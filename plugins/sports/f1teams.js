// plugins/sports/f1teams.js — tim/konstruktor F1 (f1api.dev).
import { searchTeams, getTeamById, fmtTeam } from "@/src/services/f1.js";

export default {
  name: "f1teams",
  aliases: ["f1team", "f1tim", "teams"],
  description: "Cari/list tim F1: aktif & klasik (sumber: f1api.dev)",
  usage: "[nama/id tim, cth: ferrari / red_bull]",
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const query = (args || []).join(" ").trim();
    await sendTyping();
    try {
      if (!query) {
        const list = await searchTeams("", 10);
        let text = `🏁 *DAFTAR TIM F1 (10 pertama)*\n\n`;
        list.forEach((t, i) => {
          text += `${i + 1}. *${t.teamName}* (\`${t.teamId}\`)\n`;
        });
        text += `\n💡 Cari: \`${currentPrefix}f1teams ferrari\``;
        return reply(text.trim());
      }
      if (/^[a-z0-9_]+$/i.test(query) && !query.includes(" ")) {
        try {
          const t = await getTeamById(query);
          return reply(fmtTeam(t));
        } catch (_) {}
      }
      const hits = await searchTeams(query, 10);
      if (!hits.length) return reply(`❌ Tim "${query}" tidak ditemukan.\nCoba: \`${currentPrefix}f1teams ferrari\``);
      if (hits.length === 1) return reply(fmtTeam(hits[0]));
      let text = `🏁 *HASIL "${query}" (${hits.length})*\n\n`;
      hits.forEach((t, i) => {
        text += `${i + 1}. *${t.teamName}* (\`${t.teamId}\`) — ${t.teamNationality || "-"}\n`;
      });
      text += `\n💡 Detail: \`${currentPrefix}f1teams <teamId>\``;
      return reply(text.trim());
    } catch (err) {
      return reply(`❌ Gagal memuat data tim: ${err.message}`);
    }
  },
};
