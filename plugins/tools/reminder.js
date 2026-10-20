function parseDuration(input) {
  const m = String(input || "").trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
  const ms = n * mult;
  if (!Number.isFinite(ms) || ms < 1000 || ms > 24 * 60 * 60 * 1000) return null;
  return ms;
}

export default {
  name: "ingat",
  aliases: ["remind", "reminder", "timer", "pengingat"],
  description: "Set pengingat yang akan dikirim setelah durasi tertentu",
  usage: "<durasi> <pesan>, cth: ingat 10m beli susu | ingat 2h meeting",
  premiumOnly: false,
  cooldownMs: 2000,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const dur = parseDuration(args?.[0]);
    if (!dur) {
      return reply(
        `*PENGINGAT*\n\n` +
          `• \`${currentPrefix}ingat 10m beli susu\`\n` +
          `• \`${currentPrefix}ingat 2h meeting\`\n` +
          `• \`${currentPrefix}ingat 30s cek oven\`\n\n` +
          `Durasi: 1s - 24h (s/m/h/d).`
      );
    }

    const text = (args || []).slice(1).join(" ").trim();
    if (!text) return reply(`Masukkan pesan pengingat!\nContoh: \`${currentPrefix}ingat 10m beli susu\``);

    await sendTyping();
    const jid = msg.key.remoteJid;
    const human = args[0];
    await reply(`⏰ Pengingat diset: *${human}* → "${text}"`);

    setTimeout(async () => {
      try {
        await sock.sendMessage(jid, { text: `⏰ *Pengingat:* ${text}` }, { quoted: msg });
      } catch (_) {
        try {
          await sock.sendMessage(jid, { text: `⏰ *Pengingat:* ${text}` });
        } catch (_) {}
      }
    }, dur);

    return;
  },
};