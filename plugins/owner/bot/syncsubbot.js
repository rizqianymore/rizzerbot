export default {
  name: "syncsubbot",
  aliases: ["updatesubbot", "syncbot"],
  description: "Perbarui dan sinkronkan database serta pengaturan seluruh sub-bot yang ada di server",
  usage: "",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, sendTyping, senderJid, logger, isPrimarySuperOwner }) => {
    logger?.warn?.(`[OwnerCmd] syncsubbot oleh ${senderJid}`);
    if (!isPrimarySuperOwner) {
      return reply("Fitur sinkronisasi server hanya dapat dijalankan oleh SuperOwner Bot Utama.");
    }
    await sendTyping();
    const { syncSubBotsDatabase, getSubBotsList, getAllSubBotNumbers } =
      await import("@/src/services/system/subbot/subbot.js");
    const count = await syncSubBotsDatabase();
    const known = getAllSubBotNumbers();
    const online = getSubBotsList().filter((b) => b.status === "online").length;
    await reply(
      `*Sinkronisasi Database Sub-Bot Berhasil!*\n\n` +
        `*Sub-Bot Terdeteksi:* ${known.length} nomor\n` +
        `*Tersinkron:* ${count} sesi\n` +
        `*Status Aktif:* ${online} online / ${known.length} total\n` +
        `*Pengaturan:* Data & konfigurasi masing-masing sub-bot telah diperbarui tanpa bentrok peran.`
    );
  },
};
