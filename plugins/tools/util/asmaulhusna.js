import { request } from "@/src/utils/request.js";

export default {
  name: "asmaulhusna",
  aliases: ["asmaul", "asma"],
  description: "Menampilkan 99 Asmaul Husna beserta lafadz Arab, latin, dan artinya",
  usage: "[nomor 1-99 / nama]",
  category: "Tools & Media",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const query = args[0]?.trim();
    const p = prefix || ".";

    try {
      const res = await request.json(
        "https://raw.githubusercontent.com/BochilTeam/database/master/religi/asmaulhusna.json",
        {
          timeout: 15000,
        }
      );

      const list = Array.isArray(res) ? res : res.result || [];
      if (!list.length) throw new Error("Gagal memuat basis data Asmaul Husna.");

      if (!query) {
        const item = list[Math.floor(Math.random() * list.length)];
        const text =
          `*ASMAUL HUSNA (NO. ${item.index})*\n\n` +
          `*${item.arabic}*\n` +
          `_${item.latin}_\n\n` +
          `Artinya: "${item.translation_id || item.translation}"\n\n` +
          `_Ketik \`${p}asmaulhusna <1-99>\` untuk melihat nomor tertentu._`;
        return reply(text);
      }

      const num = parseInt(query, 10);
      let found = null;
      if (!isNaN(num) && num >= 1 && num <= 99) {
        found = list.find((item) => Number(item.index) === num);
      } else {
        found = list.find(
          (item) =>
            item.latin.toLowerCase().includes(query.toLowerCase()) ||
            (item.translation_id && item.translation_id.toLowerCase().includes(query.toLowerCase()))
        );
      }

      if (!found) {
        return reply(`Asmaul Husna dengan pencarian "${query}" tidak ditemukan.`);
      }

      const text =
        `*ASMAUL HUSNA (NO. ${found.index})*\n\n` +
        `*${found.arabic}*\n` +
        `_${found.latin}_\n\n` +
        `Artinya: "${found.translation_id || found.translation}"`;

      return reply(text);
    } catch (err) {
      return reply(`Gagal memuat Asmaul Husna: ${err.message}`);
    }
  },
};
