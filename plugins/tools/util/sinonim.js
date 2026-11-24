import { request } from "@/src/utils/request.js";

export default {
  name: "sinonim",
  aliases: ["tesaurus", "antonim", "persamaankata"],
  description: "Pencarian persamaan kata (sinonim) dan lawan kata (antonim) bahasa Indonesia",
  usage: "<kata>",
  category: "Tools",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const kata = (args[0] || "").toLowerCase().trim();
    const p = prefix || ".";

    if (!kata) {
      return reply(
        `*TESAURUS BAHASA INDONESIA*\n\n` + `Format: \`${p}sinonim <kata>\`\n` + `Contoh: \`${p}sinonim pintar\``
      );
    }

    await sendTyping();

    try {
      const url = `https://m-tesaurus.kemdikbud.go.id/rest/sinonim/${encodeURIComponent(kata)}`;
      const res = await request.json(url, { timeout: 15000 });

      const sinonimList = res.sinonim || [];
      const antonimList = res.antonim || [];

      if (!sinonimList.length && !antonimList.length) {
        return reply(`Kata "*${kata}*" tidak ditemukan dalam Tesaurus Tematis Kemdikbud.`);
      }

      let text = `*TESAURUS KATA: ${kata.toUpperCase()}*\n\n`;
      if (sinonimList.length) {
        text += `*Sinonim (Persamaan Kata):*\n${sinonimList.slice(0, 15).join(", ")}\n\n`;
      }
      if (antonimList.length) {
        text += `*Antonim (Lawan Kata):*\n${antonimList.slice(0, 15).join(", ")}\n\n`;
      }

      return reply(text.trim());
    } catch (_) {
      return reply(`Gagal memuat tesaurus untuk kata "*${kata}*".`);
    }
  },
};
