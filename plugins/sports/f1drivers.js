// plugins/sports/f1drivers.js — pembalap F1 (f1api.dev).
import { searchDrivers, getDriverById, fmtDriver } from "@/src/services/f1.js";

export default {
  name: "f1drivers",
  aliases: ["f1driver", "f1pembalap", "drivers"],
  description: "Cari/list pembalap F1: aktif & legendaris (sumber: f1api.dev)",
  usage: "[nama/id/shortname, cth: alonso / VER / verstappen]",
  premiumOnly: true,
  category: "Sports",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const query = (args || []).join(" ").trim();
    await sendTyping();
    try {
      if (!query) {
        const list = await searchDrivers("", 10);
        let text = `🏎️ *DAFTAR PEMBALAP F1 (10 pertama)*\n\n`;
        list.forEach((d, i) => {
          text += `${i + 1}. *${d.name} ${d.surname}* (\`${d.driverId}\`${d.shortName ? ` / ${d.shortName}` : ""})\n`;
        });
        text += `\n💡 Cari: \`${currentPrefix}f1drivers alonso\` | Detail: \`${currentPrefix}f1drivers max_verstappen\``;
        return reply(text.trim());
      }
      // ID langsung tanpa spasi (cth: max_verstappen) -> detail cepat
      if (/^[a-z0-9_]+$/i.test(query) && !query.includes(" ")) {
        try {
          const d = await getDriverById(query);
          return reply(fmtDriver(d));
        } catch (_) { /* jatuh ke pencarian */ }
      }
      const hits = await searchDrivers(query, 10);
      if (!hits.length) return reply(`❌ Pembalap "${query}" tidak ditemukan.\nCoba: \`${currentPrefix}f1drivers alonso\` atau \`${currentPrefix}f1drivers VER\``);
      if (hits.length === 1) return reply(fmtDriver(hits[0]));
      let text = `🏎️ *HASIL "${query}" (${hits.length})*\n\n`;
      hits.forEach((d, i) => {
        text += `${i + 1}. *${d.name} ${d.surname}* (\`${d.driverId}\`${d.shortName ? ` / ${d.shortName}` : ""}) — ${d.nationality || "-"}\n`;
      });
      text += `\n💡 Detail: \`${currentPrefix}f1drivers <driverId>\``;
      return reply(text.trim());
    } catch (err) {
      return reply(`❌ Gagal memuat data pembalap: ${err.message}`);
    }
  },
};
