export default {
  name: "siapakah",
  aliases: ["siapa", "whos"],
  description: "Bot memilih anggota grup secara acak sesuai dengan pertanyaan",
  usage: "<pertanyaan>",
  category: "Group",
  groupOnly: true,
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, isGroup, prefix }) => {
    const question = args.join(" ").trim();
    const p = prefix || ".";

    if (!question) {
      return reply(
        `*SIAPAKAH MEMBER GRUP*\n\n` +
          `Format: \`${p}siapakah <pertanyaan>\`\n` +
          `Contoh: \`${p}siapakah yang paling sering begadang?\``
      );
    }

    if (!isGroup) return reply("Perintah ini hanya dapat digunakan di dalam grup!");

    await sendTyping();

    try {
      const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
      const participants = groupMetadata?.participants || [];
      if (!participants.length) return reply("Gagal membaca daftar anggota grup.");

      const randomMember = participants[Math.floor(Math.random() * participants.length)];
      const targetJid = randomMember.id;
      const targetNum = targetJid.split("@")[0].split(":")[0];

      const text =
        `*SIAPAKAH GRUP*\n` +
        `├─ Pertanyaan : ${question}\n` +
        `└─ Terpilih   : @${targetNum}`;

      return sock.sendMessage(
        msg.key.remoteJid,
        { text, mentions: [targetJid] },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal memilih anggota: ${err.message}`);
    }
  },
};
