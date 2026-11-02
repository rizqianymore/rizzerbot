const activeReminders = new Map();

function parseDuration(input) {
  const m = String(input || "").trim().match(/^(\d+)\s*(s|detik|m|menit|min|h|jam|hour|d|hari|day)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const mult = ["s", "detik"].includes(u) ? 1000 : ["m", "menit", "min"].includes(u) ? 60000 : ["h", "jam", "hour"].includes(u) ? 3600000 : 86400000;
  const ms = n * mult;
  if (!Number.isFinite(ms) || ms < 1000 || ms > 7 * 24 * 60 * 60 * 1000) return null;
  return ms;
}

export default {
  name: "ingat",
  aliases: ["remind", "reminder", "timer", "pengingat"],
  description: "Set pengingat (mendukung s/m/h/d, list & cancel)",
  usage: "<durasi> <pesan> | list | cancel <id>",
  premiumOnly: false,
  cooldownMs: 2000,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix, senderJid }) => {
    const currentPrefix = prefix || ".";
    const sub = String(args?.[0] || "").toLowerCase();

    if (sub === "list") {
      const list = [...activeReminders.values()].filter((r) => r.jid === msg.key.remoteJid);
      if (!list.length) return reply("Tidak ada pengingat aktif di chat ini.");
      const lines = list.map((r) => `• #${r.id} ${r.human} → ${r.text} (sisa ${Math.max(0, Math.ceil((r.at - Date.now()) / 1000))}s)`);
      return reply(`*DAFTAR PENGINGAT*\n\n${lines.join("\n")}\n\nBatalkan: \`${currentPrefix}ingat cancel <id>\``);
    }
    if (sub === "cancel" || sub === "del" || sub === "hapus") {
      const id = String(args?.[1] || "").trim();
      if (!id) return reply(`Gunakan: \`${currentPrefix}ingat cancel <id>\` (lihat \`${currentPrefix}ingat list\`)`);
      const rec = activeReminders.get(id);
      if (!rec || rec.jid !== msg.key.remoteJid) return reply("ID tidak ditemukan di chat ini.");
      clearTimeout(rec.timer);
      activeReminders.delete(id);
      return reply(`✅ Pengingat #${id} dibatalkan.`);
    }

    const dur = parseDuration(args?.[0]);
    if (!dur) {
      return reply(
        `*PENGINGAT*\n\n` +
          `• \`${currentPrefix}ingat 10m beli susu\`\n` +
          `• \`${currentPrefix}ingat 2h meeting\`\n` +
          `• \`${currentPrefix}ingat 30s cek oven\`\n` +
          `• \`${currentPrefix}ingat 1hari bayar kos\`\n\n` +
          `Durasi: 1s - 7 hari. Alias: s/detik, m/menit, h/jam, d/hari\n` +
          `Lihat: \`${currentPrefix}ingat list\` | Batal: \`${currentPrefix}ingat cancel <id>\``
      );
    }

    const text = (args || []).slice(1).join(" ").trim();
    if (!text) return reply(`Masukkan pesan pengingat!\nContoh: \`${currentPrefix}ingat 10m beli susu\``);
    if (text.length > 500) return reply("Pesan pengingat maks 500 karakter.");

    await sendTyping();
    const jid = msg.key.remoteJid;
    const human = args[0];
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const at = Date.now() + dur;
    await reply(`⏰ Pengingat #${id} diset: *${human}* → "${text}"\nKetik \`${currentPrefix}ingat list\` untuk melihat.`);

    const timer = setTimeout(async () => {
      activeReminders.delete(id);
      try {
        await sock.sendMessage(jid, { text: `⏰ *Pengingat #${id}:* ${text}` }, { quoted: msg });
      } catch (_) {
        try {
          await sock.sendMessage(jid, { text: `⏰ *Pengingat #${id}:* ${text}` });
        } catch (_) {}
      }
    }, dur);
    if (timer.unref) timer.unref();
    activeReminders.set(id, { id, jid, senderJid, text, human, at, timer });
    return;
  },
};