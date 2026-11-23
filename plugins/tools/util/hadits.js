import { request } from "@/src/utils/request.js";

export default {
  name: "hadits",
  aliases: ["hadist", "shahih"],
  description: "Pencarian hadits shahih (Bukhari, Muslim, Abu Dawud, Tirmidzi, dll)",
  usage: "<perawi> <nomor hadits>",
  category: "Tools & Media",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    const perawi = (args[0] || "").toLowerCase();
    const nomor = parseInt(args[1], 10);

    if (!perawi || isNaN(nomor)) {
      return reply(
        `*ENSIKLOPEDIA HADITS SHAHIH*\n\n` +
          `Format: \`${p}hadits <perawi> <nomor>\`\n\n` +
          `*Pilihan Perawi:*\n` +
          `│ bukhari (1 - 7008)\n` +
          `│ muslim (1 - 5362)\n` +
          `│ abudaud (1 - 4590)\n` +
          `│ tirmidzi (1 - 3625)\n` +
          `│ nasai (1 - 5364)\n` +
          `│ ibnumajah (1 - 4331)\n\n` +
          `*Contoh:*\n` +
          `│ \`${p}hadits bukhari 1\`\n` +
          `│ \`${p}hadits muslim 10\``
      );
    }

    await sendTyping();

    try {
      const url = `https://hadis-api-id.vercel.app/hadith/${perawi}/${nomor}`;
      const res = await request.json(url, { timeout: 20000 });

      if (!res || !res.name || !res.number) {
        return reply(`Hadits ${perawi} nomor ${nomor} tidak ditemukan.`);
      }

      let text = `*HADITS RIWAYAT ${res.name.toUpperCase()} NO. ${res.number}*\n\n`;
      text += `${res.arab}\n\n`;
      text += `*Artinya:*\n"${res.id}"`;

      return reply(text);
    } catch (err) {
      return reply(`Gagal mengambil data hadits: ${err.message}`);
    }
  },
};
