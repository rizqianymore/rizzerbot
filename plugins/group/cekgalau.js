const HEARTBREAK_STAGES = [
  "Masih sering stalking story dan last seen WhatsApp doi.",
  "Dengerin lagu galau sambil mandang langit-langit kamar.",
  "Lagi di fase pura-pura tegar padahal hatinya remuk redam.",
  "Sudah mulai bisa tersenyum tanpa mengingat kenangan pahit.",
  "Sudah 100% sembuh total dan siap buka lembaran cinta yang baru!",
];

export default {
  name: "cekgalau",
  aliases: ["levelgalau", "galaumeter"],
  description: "Deteksi seberapa parah tingkat kegalauan hati seseorang",
  usage: "[nama / target]",
  category: "Group",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = args.join(" ").trim() || "Kamu";
    const percent = Math.floor(Math.random() * 101);

    const stageIdx = Math.min(Math.floor(percent / 20), HEARTBREAK_STAGES.length - 1);
    const stage = HEARTBREAK_STAGES[stageIdx];

    const text =
      `*RADAR GALAU METER* 🌧️💔\n` +
      `├─ Pasien    : ${target}\n` +
      `├─ Level     : *${percent}%*\n` +
      `└─ Kondisi   : ${stage}`;

    return reply(text);
  },
};
