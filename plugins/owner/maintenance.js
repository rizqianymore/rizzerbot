// plugins/owner/maintenance.js — perintah "maintenance" (SuperOwner saja).
// Kunci/buka bot: saat ON, hanya owner yang bisa pakai perintah.
// Mendukung --all untuk semua sub-bot (seperti pola self/public).
import { db } from '@/src/core/database.js';

export default {
  "name": "maintenance",
  "aliases": ["mainten", "mt", "perawatan"],
  "description": "Aktif/matikan mode maintenance (hanya owner bisa pakai bot)",
  "usage": "[on/off] [--all]",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, senderJid, botJid, logger, isPrimarySuperOwner }) => {
      logger?.warn?.(`[OwnerCmd] maintenance oleh ${senderJid} args=${args.join(" ")}`);
      const activeBotJid = botJid || db.normalizeJid(sock.user?.id);
      if (!senderJid || !db.isBotOwner(activeBotJid, senderJid)) {
        return reply("❌ Perintah ini hanya untuk Owner bot ini!");
      }

      const wantAll = args.some((a) => String(a).toLowerCase() === "--all");
      if (wantAll && !isPrimarySuperOwner) {
        return reply("❌ Flag --all hanya dapat dipakai SuperOwner Bot Utama.");
      }
      const arg = String(args.find((a) => !a.startsWith("--")) || "").toLowerCase();

      const applyTo = (targetJid, enabled) => {
        const cur = db.runWithBot(targetJid, () => db.getSettings());
        if (Boolean(cur.maintenance) === enabled) return false;
        db.runWithBot(targetJid, () => db.updateSettings({ maintenance: enabled }));
        return true;
      };

      // Tanpa argumen: tampilkan status.
      if (!arg) {
        const cur = db.getSettings();
        return reply(
          `*STATUS MAINTENANCE: ${cur.maintenance ? "ON" : "OFF"}*\n\n` +
          `• .maintenance on — kunci bot (hanya owner)\n` +
          `• .maintenance off — buka kunci\n` +
          `• Tambah --all untuk semua bot`
        );
      }

      const enabled = ["on", "1", "ya", "aktif"].includes(arg)
        ? true
        : ["off", "0", "tidak", "mati"].includes(arg)
          ? false
          : null;
      if (enabled === null) return reply("❌ Pakai *.maintenance on* atau *.maintenance off*.");

      await sendTyping();
      if (wantAll) {
        let changed = 0;
        const targets = ["", ...db.getKnownSubDigits().map((d) => `${d}@s.whatsapp.net`)];
        for (const t of targets) {
          try {
            if (db.runWithBot(t, () => {
              const cur = db.getSettings();
              if (Boolean(cur.maintenance) === enabled) return false;
              db.updateSettings({ maintenance: enabled });
              return true;
            })) changed++;
          } catch (_) {}
        }
        return reply(`🔧 *Maintenance ${enabled ? "ON" : "OFF"} untuk ${changed} bot.*`);
      }

      const changed = applyTo(activeBotJid, enabled);
      reply(changed
        ? `🔧 *Maintenance ${enabled ? "DIAKTIFKAN" : "DIMATIKAN"}* untuk bot ini.${enabled ? "\nSelain owner, perintah user akan diabaikan." : ""}`
        : `ℹ️ Maintenance bot ini sudah ${enabled ? "ON" : "OFF"}.`);
    },
};
