import { request } from "@/src/utils/request.js";

export default {
  name: "kisahnabi",
  aliases: ["nabi", "ceritanabi"],
  description: "Kisah inspiratif dan mukjizat 25 Nabi dan Rasul Allah",
  usage: "<nama nabi>",
  category: "Tools",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    const nameQuery = (args[0] || "").toLowerCase().trim();

    if (!nameQuery) {
      return reply(
        `*KISAH 25 NABI & RASUL*\n\n` +
          `Format: \`${p}kisahnabi <nama nabi>\`\n` +
          `Contoh:\n` +
          `│ \`${p}kisahnabi musa\`\n` +
          `│ \`${p}kisahnabi muhammad\`\n` +
          `│ \`${p}kisahnabi ibrahim\``
      );
    }

    await sendTyping();

    try {
      const url = `https://raw.githubusercontent.com/BochilTeam/database/master/religi/kisahnabi/${nameQuery}.json`;
      const data = await request.json(url, { timeout: 15000 });

      if (!data || !data.name) {
        return reply(`Kisah Nabi "${nameQuery}" tidak ditemukan. Pastikan ejaan nama nabi benar.`);
      }

      let text = `*KISAH NABI ${data.name.toUpperCase()}*\n`;
      text += `├─ Lahir   : ${data.thn_kelahiran || "-"}\n`;
      text += `├─ Usia    : ${data.usia || "-"} tahun\n`;
      text += `├─ Tempat  : ${data.tmp || "-"}\n\n`;
      text += `*Ringkasan Riwayat:*\n${data.description?.slice(0, 1500) || "-"}`;

      if (data.description?.length > 1500) {
        text += `...\n\n_(Kisah dipersingkat agar muat di chat WhatsApp)_`;
      }

      return reply(text);
    } catch (_) {
      return reply(`Kisah Nabi "${nameQuery}" tidak ditemukan.`);
    }
  },
};
