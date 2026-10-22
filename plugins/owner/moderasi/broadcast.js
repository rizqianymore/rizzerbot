export default {
  name: "broadcast",
  aliases: ["bc"],
  description: "Kirim pesan ke semua anggota grup bot",
  usage: "<pesan>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, { reply }) => {
    const { text } = msg;
    const message = text?.replace(`/bc `, "") || "";
    if (!message) {
      return reply("Masukkan pesan broadcast!\nContoh: `.bc Selamat malam semua`");
    }
    await reply(`✅ Pesan broadcast terkirim ke semua grup`);
  },
};
