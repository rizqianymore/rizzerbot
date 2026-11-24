export default {
  name: "cekbucin",
  aliases: ["bucinmeter", "levelbucin"],
  description: "Ukur seberapa tinggi persentase tingkat kebucinan Anda",
  usage: "[nama / mention target]",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const target = mentionedJid ? `@${mentionedJid.split("@")[0].split(":")[0]}` : args.join(" ").trim() || "Kamu";

    const today = new Date().toISOString().slice(0, 10);
    const seed = `${target.toLowerCase()}_${today}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 33 + seed.charCodeAt(i)) % 1000000;
    }

    const percentage = 15 + (Math.abs(hash) % 85);

    let status = "Masih rasional dan terkendali.";
    if (percentage >= 90) status = "BUCIN AKUT TINGKAT DEWA! Dunia serasa milik berdua, yang lain cuma ngontrak.";
    else if (percentage >= 75) status = "Bucin stadium 3. Rela begadang demi nungguin kabar doi.";
    else if (percentage >= 50) status = "Bucin wajar. Sayang tapi masih mikir logika.";
    else if (percentage >= 30) status = "Dingin tapi perhatian diam-diam (Tsundere).";

    const text =
      `*BUCIN METER CHECKER* 🧪❤️\n` +
      `├─ Target       : ${target}\n` +
      `├─ Tingkat Bucin: *${percentage}%*\n` +
      `└─ Diagnosis    : ${status}`;

    if (mentionedJid) {
      return sock.sendMessage(msg.key.remoteJid, { text, mentions: [mentionedJid] }, { quoted: msg });
    }
    return reply(text);
  },
};
