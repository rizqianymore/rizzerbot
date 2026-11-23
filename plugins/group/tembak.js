const TEMBAK_RESPONSES = [
  { accept: true, text: "AKU TERIMA! ❤️ Aku juga udah lama nunggu momen ini..." },
  { accept: true, text: "Iya, aku mau jadi pacar kamu! Jangan bikin aku kecewa ya." },
  { accept: false, text: "Maaf ya, kamu terlalu baik buat aku. Kita temenan aja." },
  { accept: false, text: "Aduh, aku lagi mau fokus belajar dan ngejar karier dulu." },
  { accept: false, text: "Maaf banget, aku udah terlanjur nyaman anggap kamu kakak sendiri." },
  { accept: true, text: "Gak nyangka kamu berani nembak! Jawabannya: YES! 💖" },
];

export default {
  name: "tembak",
  aliases: ["confess", "nembakdoi"],
  description: "Simulasi menyatakan perasaan cinta / nembak doi di grup",
  usage: "<tag target / nama>",
  category: "Group",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const target = mentionedJid ? `@${mentionedJid.split("@")[0].split(":")[0]}` : args.join(" ").trim();
    const p = prefix || ".";

    if (!target) {
      return reply(
        `*SIMULASI TEMBAK DOI*\n\n` +
        `Format: \`${p}tembak @user\` atau \`${p}tembak <nama>\`\n` +
        `Contoh: \`${p}tembak @628123456789\``
      );
    }

    await sendTyping();
    const res = TEMBAK_RESPONSES[Math.floor(Math.random() * TEMBAK_RESPONSES.length)];

    const text =
      `*SURAT PERNYATAAN CINTA* 💌\n` +
      `├─ Dari      : @${msg.key.participant?.split("@")[0] || msg.key.remoteJid.split("@")[0]}\n` +
      `├─ Kepada    : ${target}\n` +
      `└─ Jawaban   : *${res.text}*`;

    const mentions = [];
    if (msg.key.participant) mentions.push(msg.key.participant);
    if (mentionedJid) mentions.push(mentionedJid);

    return sock.sendMessage(msg.key.remoteJid, { text, mentions }, { quoted: msg });
  },
};
