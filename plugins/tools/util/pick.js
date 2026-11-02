import crypto from "crypto";

function pickRandom(arr) {
  const idx = crypto.randomInt(0, arr.length);
  return arr[idx];
}

export default {
  name: "pick",
  aliases: ["choose", "pilih", "random", "dice", "dadu", "coin", "koin"],
  description: "Pilih acak, dadu, koin",
  usage: "<opsi>, cth: pick a|b|c | pick pizza|burger | dice | coin",
  category: "Tools",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, prefix }) => {
    const raw = args.join(" ").trim();
    const cmd = String(msg.message?.extendedTextMessage?.text || msg.message?.conversation || "")
      .trim()
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/^[./!]/, "");
    if (["dice", "dadu"].includes(cmd)) {
      const n = crypto.randomInt(1, 7);
      return reply(`🎲 Dadu: *${n}*`);
    }
    if (["coin", "koin"].includes(cmd)) {
      return reply(`🪙 Koin: *${pickRandom(["Kepala", "Ekor"])}*`);
    }
    if (!raw) {
      const p = prefix || ".";
      return reply(
        `*PICK RANDOM*\nContoh:\n• \`${p}pick apel|jeruk|mangga\`\n• \`${p}pick pizza, burger, sate\`\n• \`${p}dice\` lempar dadu\n• \`${p}coin\` lempar koin`
      );
    }
    const opts = raw
      .split(/[|,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (opts.length < 2) {
      return reply("Minimal 2 pilihan. Contoh: `pick a|b|c`");
    }
    const chosen = pickRandom(opts);
    return reply(`*PICK:*\nPilihan: ${opts.join(" | ")}\nHasil: *${chosen}*`);
  },
};
