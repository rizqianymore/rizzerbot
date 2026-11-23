const GOMBALAN_LIST = [
  "Kamu tahu gak bedanya kamu sama modem? Kalau modem terhubung ke internet, kalau kamu terhubung ke hatiku.",
  "Muka kamu jangan sering-sering ditekuk gitu dong, nanti indahnya duniaku jadi ikutan terlipat.",
  "Kamu itu kayak lempengan bumi ya? Soalnya tiap kali kamu senyum, hatiku selalu gempa.",
  "Aku gak sedih kok kalau besok hujan badai, asalkan hujannya bareng kamu di pelaminan.",
  "Cita-citaku dulu mau jadi astronot keliling angkasa, tapi pas ketemu kamu, mengelilingi hidupmu udah lebih dari cukup.",
  "Kamu punya peta gak? Soalnya aku tersesat di dalam matamu dan gak tahu jalan pulang.",
  "Kalau disuruh milih antara bernapas atau mencintaimu, aku bakal pakai napas terakhirku buat bilang 'aku sayang kamu'.",
  "Tahu gak kenapa kopi rasanya pahit? Karena manisnya udah diborong semua sama senyumanmu.",
  "Kamu jangan jalan sendirian malam-malam ya, nanti bintang-bintang di langit pada minder liat pesonamu.",
  "Rumah sakit jiwa di mana ya? Kayaknya aku udah gila gara-gara mikirin kamu seharian.",
];

export default {
  name: "gombal",
  aliases: ["gombalan", "rayuan", "flirt"],
  description: "Menghasilkan kalimat gombalan maut dan rayuan romantis",
  usage: "[tag target (opsional)]",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const item = GOMBALAN_LIST[Math.floor(Math.random() * GOMBALAN_LIST.length)];
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (mentionedJid) {
      const targetNum = mentionedJid.split("@")[0].split(":")[0];
      const text =
        `*GOMBALAN MAUT UNTUK @${targetNum}* 💕\n\n` +
        `"${item}"\n\n` +
        `_Awas klepek-klepek ya!_`;

      return sock.sendMessage(
        msg.key.remoteJid,
        { text, mentions: [mentionedJid] },
        { quoted: msg }
      );
    }

    return reply(`*GOMBALAN MAUT* 💘\n\n"${item}"`);
  },
};
