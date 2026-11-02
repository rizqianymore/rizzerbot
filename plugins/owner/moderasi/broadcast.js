export default {
  name: "broadcast",
  aliases: ["bc"],
  description: "Kirim pesan ke semua grup bot",
  usage: "<pesan>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply }) => {
    const message = args.join(" ").trim();
    if (!message) {
      return reply("Masukkan pesan broadcast!\nContoh: `.bc Selamat malam semua`");
    }
    await reply(`⏳ Broadcast ke semua grup...`);
    try {
      const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
      const ids = Object.keys(groups);
      let sent = 0;
      for (const id of ids) {
        try {
          await sock.sendMessage(id, { text: `📢 *Broadcast*\n\n${message}` });
          sent++;
          await new Promise((r) => setTimeout(r, 800));
        } catch (_) {}
      }
      await reply(`✅ Broadcast terkirim ke ${sent}/${ids.length} grup`);
    } catch (e) {
      await reply(`❌ Gagal broadcast: ${e?.message || e}`);
    }
  },
};
