import { db } from "@/src/core/database.js";
import { settings } from "@/config/settings.js";

export default {
  name: "mode",
  description: "Manajemen dan kontrol mode operasional sistem bot.",
  usage: "<self | public | maintenance | onlygc | onlypc | antispam | register | prefix> [on/off/value]",
  example: "mode maintenance on",
  aliases: ["botmode", "self", "public", "maintenance", "onlygc", "onlypc", "setprefix"],
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix, commandName } = context;
    await sendTyping();

    const currentSettings = db.getSettings();
    let action = args[0]?.toLowerCase();
    let value = args[1]?.toLowerCase();

    // Jika dipanggil via alias langsung seperti .self, .public, .maintenance, dll.
    if (commandName === "self") {
      action = "self";
      value = args[0]?.toLowerCase() || "on";
    } else if (commandName === "public") {
      action = "public";
      value = "on";
    } else if (commandName === "maintenance") {
      action = "maintenance";
      value = args[0]?.toLowerCase() || (currentSettings.maintenance ? "off" : "on");
    } else if (commandName === "onlygc") {
      action = "onlygc";
      value = args[0]?.toLowerCase() || (currentSettings.onlyGroup ? "off" : "on");
    } else if (commandName === "onlypc") {
      action = "onlypc";
      value = args[0]?.toLowerCase() || (currentSettings.onlyPrivate ? "off" : "on");
    } else if (commandName === "setprefix") {
      action = "prefix";
      value = args[0];
    }

    // Dashboard Status (.mode)
    if (!action || action === "status" || action === "info" || action === "list") {
      const activeP = currentSettings.prefix || settings.prefix || ".";
      const sSelf = currentSettings.selfMode ? "🔴 *AKTIF (Self Only)*" : "🟢 *Nonaktif (Public)*";
      const sMaint = currentSettings.maintenance ? "🔴 *AKTIF (Maintenance)*" : "🟢 *Nonaktif (Normal)*";
      const sGroup = currentSettings.onlyGroup ? "🟡 *AKTIF (Grup Saja)*" : "⚪ *Nonaktif*";
      const sPrive = currentSettings.onlyPrivate ? "🟡 *AKTIF (Private Saja)*" : "⚪ *Nonaktif*";
      const sSpam = currentSettings.antiSpam !== false ? "🟢 *AKTIF (Proteksi Nyala)*" : "🔴 *Nonaktif*";
      const sReg = currentSettings.registrationOpen !== false ? "🟢 *TERBUKA*" : "🔴 *DITUTUP*";

      const dashboard =
        `🎛️ *DASHBOARD OPERASIONAL BOT*\n\n` +
        `├─ 👤 *Self Mode:* ${sSelf}\n` +
        `├─ 🛠️ *Maintenance:* ${sMaint}\n` +
        `├─ 👥 *Only Group:* ${sGroup}\n` +
        `├─ 🔒 *Only Private:* ${sPrive}\n` +
        `├─ 🛡️ *Anti-Spam Guard:* ${sSpam}\n` +
        `├─ 📝 *Registrasi User:* ${sReg}\n` +
        `├─ ⚡ *Active Prefix:* \`${activeP}\`\n` +
        `╰─────────────────────\n\n` +
        `💡 *Perintah Kontrol Mode:*\n` +
        `│ \`${activePrefix}mode self [on/off]\` - Mode khusus Owner\n` +
        `│ \`${activePrefix}mode public\` - Kembalikan ke mode publik normal\n` +
        `│ \`${activePrefix}mode maintenance [on/off]\` - Mode perbaikan sistem\n` +
        `│ \`${activePrefix}mode onlygc [on/off]\` - Hanya merespons di grup\n` +
        `│ \`${activePrefix}mode onlypc [on/off]\` - Hanya merespons di private\n` +
        `│ \`${activePrefix}mode antispam [on/off]\` - Toggle rate-limit spam\n` +
        `│ \`${activePrefix}mode register [on/off]\` - Buka/tutup pendaftaran\n` +
        `│ \`${activePrefix}mode prefix <simbol>\` - Ubah prefix aktif bot`;

      return sock.sendMessage(msg.key.remoteJid, { text: dashboard }, { quoted: msg });
    }

    const parseToggle = (val, current) => {
      if (val === "on" || val === "1" || val === "true" || val === "aktif" || val === "enable") return true;
      if (val === "off" || val === "0" || val === "false" || val === "mati" || val === "disable") return false;
      return !current;
    };

    if (action === "self") {
      const isEnable = parseToggle(value, currentSettings.selfMode);
      db.updateSettings({ selfMode: isEnable });
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ *Self Mode:* Berhasil diubah menjadi *${isEnable ? "AKTIF" : "NONAKTIF"}*.\n${
            isEnable
              ? "_Bot sekarang hanya akan merespons perintah dari Owner & Admin._"
              : "_Bot sekarang kembali merespons semua pengguna._"
          }`,
        },
        { quoted: msg }
      );
    }

    if (action === "public") {
      db.updateSettings({
        selfMode: false,
        maintenance: false,
        onlyGroup: false,
        onlyPrivate: false,
      });
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ *Public Mode:* Semua mode pembatasan (Self, Maintenance, Only Group/Private) telah dinonaktifkan.\n_Bot kini beroperasi penuh secara normal untuk publik._`,
        },
        { quoted: msg }
      );
    }

    if (action === "maintenance" || action === "maint") {
      const isEnable = parseToggle(value, currentSettings.maintenance);
      db.updateSettings({ maintenance: isEnable });
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ *Maintenance Mode:* Berhasil diubah menjadi *${isEnable ? "AKTIF" : "NONAKTIF"}*.\n${
            isEnable
              ? "_Pengguna umum akan mendapatkan pemberitahuan pemeliharaan saat mencoba menggunakan bot._"
              : "_Mode pemeliharaan selesai, bot dapat digunakan normal kembali._"
          }`,
        },
        { quoted: msg }
      );
    }

    if (action === "onlygc" || action === "group" || action === "onlygroup") {
      const isEnable = parseToggle(value, currentSettings.onlyGroup);
      db.updateSettings({ onlyGroup: isEnable, onlyPrivate: isEnable ? false : currentSettings.onlyPrivate });
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ *Only Group Mode:* Berhasil diubah menjadi *${isEnable ? "AKTIF" : "NONAKTIF"}*.\n${
            isEnable
              ? "_Bot sekarang hanya akan merespons perintah di dalam grup WhatsApp._"
              : "_Bot dapat digunakan di grup dan chat pribadi._"
          }`,
        },
        { quoted: msg }
      );
    }

    if (action === "onlypc" || action === "private" || action === "onlyprivate") {
      const isEnable = parseToggle(value, currentSettings.onlyPrivate);
      db.updateSettings({ onlyPrivate: isEnable, onlyGroup: isEnable ? false : currentSettings.onlyGroup });
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ *Only Private Mode:* Berhasil diubah menjadi *${isEnable ? "AKTIF" : "NONAKTIF"}*.\n${
            isEnable
              ? "_Bot sekarang hanya akan merespons perintah di chat pribadi (DM)._"
              : "_Bot dapat digunakan di grup dan chat pribadi._"
          }`,
        },
        { quoted: msg }
      );
    }

    if (action === "antispam" || action === "spam") {
      const isEnable = parseToggle(value, currentSettings.antiSpam !== false);
      db.updateSettings({ antiSpam: isEnable });
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ *Anti-Spam Guard:* Berhasil diubah menjadi *${isEnable ? "AKTIF" : "NONAKTIF"}*.`,
        },
        { quoted: msg }
      );
    }

    if (action === "register" || action === "reg") {
      const isEnable = parseToggle(value, currentSettings.registrationOpen !== false);
      db.updateSettings({ registrationOpen: isEnable });
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ *Pendaftaran Pengguna:* Berhasil diubah menjadi *${isEnable ? "TERBUKA" : "DITUTUP"}*.`,
        },
        { quoted: msg }
      );
    }

    if (action === "prefix") {
      const newPrefix = value || args[1];
      if (!newPrefix) {
        return sock.sendMessage(
          msg.key.remoteJid,
          { text: `⚠️ Harap tentukan simbol prefix baru.\nContoh: \`${activePrefix}mode prefix !\`` },
          { quoted: msg }
        );
      }
      db.updateSettings({ prefix: newPrefix });
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `✅ *Prefix Bot Diperbarui!*\n\nPrefix aktif bot sekarang: \`${newPrefix}\`\nContoh penggunaan: \`${newPrefix}menu\``,
        },
        { quoted: msg }
      );
    }

    return sock.sendMessage(
      msg.key.remoteJid,
      {
        text: `⚠️ *Subcommand tidak dikenal!*\n\nGunakan: \`${activePrefix}mode\` untuk melihat daftar perintah kontrol mode.`,
      },
      { quoted: msg }
    );
  },
};
