import { db } from "@/src/core/database.js";

export default {
  name: "listadminbot",
  aliases: ["botadmins", "listbotadmin"],
  description: "Lihat daftar semua Admin bot",
  usage: "",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply }) => {
    const settings = db.getSettings();
    const source = [
      ...(Array.isArray(settings.adminNumbers) ? settings.adminNumbers : []),
      ...(Array.isArray(settings.admins) ? settings.admins : []),
    ];
    const uniqueAdmins = [...new Set(source.map((j) => db.normalizeJid(j)))].filter((j) => j && !db.isOwner(j));

    if (uniqueAdmins.length === 0) {
      return reply("Belum ada Admin Bot tambahan yang terdaftar.");
    }

    let text = `*DAFTAR ADMIN*\n\n`;
    uniqueAdmins.forEach((j, i) => {
      const num = j.split("@")[0];
      text += `${i + 1}. +${num}\n`;
    });
    text += `\nTotal: ${uniqueAdmins.length} admin`;
    reply(text);
  },
};
