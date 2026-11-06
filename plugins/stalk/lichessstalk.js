import { lookupLichess } from "@/src/services/osint/lichessstalk.js";

export default {
  name: "lichessstalk",
  aliases: ["lichess", "stalklichess", "caturstalk", "chessplayer"],
  description: "Intelijen OSINT pemain & Grandmaster Catur Lichess (Rating Blitz, Bullet, Rapid, Win/Loss)",
  usage: "<username lichess>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT LICHESS CHESS PLAYER STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}lichessstalk <username-lichess>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}lichessstalk MagnusCarlsen\n` +
        `• ${context.prefix || "."}lichessstalk DanielNaroditsky`
      );
    }

    await context.sendTyping();

    const res = await lookupLichess(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const out = [
      `*HASIL INTELIJEN PEMAIN CATUR LICHESS*`,
      `Pemain       : *${res.title}${res.username}*`,
      `Member Sejak : 📅 ${res.createdDate}`,
      ``,
      `*Statistik Pertandingan:*`,
      `• Total Game : ${res.totalGames.toLocaleString("id-ID")}`,
      `• Menang (W) : 🏆 ${res.wins.toLocaleString("id-ID")}`,
      `• Kalah (L)  : ❌ ${res.losses.toLocaleString("id-ID")}`,
      `• Seri (D)   : 🤝 ${res.draws.toLocaleString("id-ID")}`,
      ``,
      `*Rating Elo Mode Catur:*`,
      `• Blitz      : ⚡ ${res.blitz}`,
      `• Bullet     : 🚅 ${res.bullet}`,
      `• Rapid      : ⏱️ ${res.rapid}`,
      `• Classical  : ⏳ ${res.classical}`,
      ``,
      `*Link Profil Resmi:*`,
      `👉 ${res.profileUrl}`
    ];

    return context.reply(out.join("\n"));
  },
};
