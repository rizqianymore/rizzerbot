import { db } from "@/src/core/database.js";

function statusLabel(status) {
  if (status === "online") return "Online";
  if (status === "connecting") return "Menghubungkan";
  if (status === "reconnecting") return "Menyambung ulang";
  return "Offline";
}

export default {
  name: "listbot",
  aliases: ["bots", "subbots"],
  description: "Melihat daftar bot yang aktif",
  usage: "",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, isPrimarySuperOwner, senderJid }) => {
    const { getSubBotsList, getAllSubBotNumbers } = await import("@/src/services/system/subbot/subbot.js");
    const running = new Map(getSubBotsList().map((b) => [String(b.number), b]));
    const numbers = getAllSubBotNumbers();

    if (numbers.length === 0) {
      return reply("Belum ada sub-bot yang terdeteksi.\nGunakan *.addbot <nomor>* untuk menambahkan bot baru.");
    }

    const entries = numbers.map((number) => {
      const num = String(number);
      const live = running.get(num);
      return { number: num, status: live?.status || "offline", uptime: live?.uptime || 0 };
    });

    const filteredList = isPrimarySuperOwner
      ? entries
      : entries.filter((b) => db.isBotOwner(`${b.number}@s.whatsapp.net`, senderJid));

    if (filteredList.length === 0) {
      return reply("Tidak ada sub-bot yang terdaftar atas kepemilikan nomor Anda.");
    }

    const lines = [`*DAFTAR BOT TERDETEKSI (${filteredList.length})*\n`];
    for (let i = 0; i < filteredList.length; i++) {
      const b = filteredList[i];
      const bSettings = db.getBotSettings(`${b.number}@s.whatsapp.net`);
      const ownerNum = bSettings.ownerNumber ? bSettings.ownerNumber.split("@")[0] : b.number;
      const mode = bSettings.public === false ? "Self" : "Public";

      lines.push(`*${i + 1}. +${b.number}*`);
      lines.push(`   • Status: ${statusLabel(b.status)} | Mode: ${mode}`);
      lines.push(`   • Owner: +${ownerNum} | Prefix: \`${bSettings.prefix || "."}\``);
      lines.push(b.status === "online" ? `   • Uptime: ${Math.floor(b.uptime / 60)} menit\n` : "");
    }

    lines.push(`_Gunakan \`.delbot <nomor>\` untuk mematikan dan menghapus bot._`);
    reply(lines.join("\n"));
  },
};
