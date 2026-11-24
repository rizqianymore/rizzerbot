import { request } from "@/src/utils/request.js";

export default {
  name: "doa",
  aliases: ["doaharian", "kumpurandoa"],
  description: "Kumpulan doa-doa harian lengkap beserta teks latin dan artinya",
  usage: "[nama doa / cari]",
  category: "Tools",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const query = args.join(" ").toLowerCase().trim();
    const p = prefix || ".";

    try {
      const list = await request.json("https://open-api.my.id/api/doa", { timeout: 15000 });
      if (!Array.isArray(list)) throw new Error("Format respons API tidak valid");

      if (!query) {

        const randomDoa = list[Math.floor(Math.random() * list.length)];
        const text =
          `*DOA HARIAN ISLAMI*\n\n` +
          `*Judul: ${randomDoa.judul}*\n\n` +
          `${randomDoa.arab}\n\n` +
          `_${randomDoa.latin}_\n\n` +
          `Artinya:\n"${randomDoa.terjemah}"\n\n` +
          `_Ketik \`${p}doa <kata kunci>\` untuk mencari doa spesifik (cth: \`${p}doa makan\`)._`;

        return reply(text);
      }

      const matches = list.filter(
        (d) => d.judul.toLowerCase().includes(query) || d.terjemah?.toLowerCase().includes(query)
      );

      if (!matches.length) {
        return reply(`Doa dengan kata kunci "*${query}*" tidak ditemukan.`);
      }

      const d = matches[0];
      const text =
        `*DOA: ${d.judul.toUpperCase()}*\n\n` + `${d.arab}\n\n` + `_${d.latin}_\n\n` + `Artinya:\n"${d.terjemah}"`;

      return reply(text);
    } catch (err) {
      return reply(`Gagal memuat doa harian: ${err.message}`);
    }
  },
};
