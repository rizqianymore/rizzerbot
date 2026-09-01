import { commands } from "@/src/core/loader.js";
import { db } from "@/src/core/database.js";

export default {
  name: "plugintoggle",
  aliases: ["plug", "switchplugin", "plugincontrol"],
  description: "Mengaktifkan atau menonaktifkan plugin tertentu secara runtime tanpa restart bot.",
  usage: "<enable/disable/list> [nama_plugin]",
  example: "plugintoggle disable tiktok",
  category: "Owner",
  ownerOnly: true,
  run: async (sock, msg, args, { sendTyping, activePrefix }) => {
    const action = args[0]?.toLowerCase();
    const pluginTarget = args[1]?.toLowerCase();

    if (!action) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `🔌 *Plugin Runtime Controller*\n\n` +
            `│ ${activePrefix}plugintoggle disable <nama_plugin>\n` +
            `│ ${activePrefix}plugintoggle enable <nama_plugin>\n` +
            `│ ${activePrefix}plugintoggle list\n\n` +
            `*Contoh:* \`${activePrefix}plugintoggle disable tiktok\``,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    if (!db.data.settings.disabledPlugins) {
      db.data.settings.disabledPlugins = [];
    }

    if (action === "list") {
      const disabled = db.data.settings.disabledPlugins;
      if (disabled.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "🟢 Semua plugin saat ini aktif dan berjalan normal." },
          { quoted: msg }
        );
        return;
      }

      let listText = `🔴 *DAFTAR PLUGIN YANG DINONAKTIFKAN (${disabled.length})*\n\n`;
      disabled.forEach((p, i) => {
        listText += `${i + 1}. *${p}*\n`;
      });
      listText += `\nKetik \`${activePrefix}plugintoggle enable <nama>\` untuk mengaktifkan kembali.`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: listText },
        { quoted: msg }
      );
      return;
    }

    if (!pluginTarget) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `⚠️ Harap masukkan nama plugin target! Contoh: \`${activePrefix}plugintoggle ${action} tiktok\`` },
        { quoted: msg }
      );
      return;
    }

    const foundCmd = commands.get(pluginTarget);
    if (!foundCmd && action === "disable") {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Plugin *${pluginTarget}* tidak ditemukan dalam sistem!` },
        { quoted: msg }
      );
      return;
    }

    const canonicalName = foundCmd?.name || pluginTarget;

    // Lindungi plugin core owner
    const protectedPlugins = ["mode", "user", "premium", "resetdb", "plugintoggle", "eval", "server"];
    if (protectedPlugins.includes(canonicalName)) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `⛔ Plugin *${canonicalName}* adalah core sistem Owner dan tidak boleh dinonaktifkan!` },
        { quoted: msg }
      );
      return;
    }

    if (action === "disable" || action === "off") {
      if (db.data.settings.disabledPlugins.includes(canonicalName)) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `ℹ️ Plugin *${canonicalName}* sudah dalam keadaan nonaktif.` },
          { quoted: msg }
        );
        return;
      }

      db.data.settings.disabledPlugins.push(canonicalName);
      db.save();

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `🔴 Plugin *${canonicalName}* berhasil DINONAKTIFKAN dari akses publik.` },
        { quoted: msg }
      );
    } else if (action === "enable" || action === "on") {
      if (!db.data.settings.disabledPlugins.includes(canonicalName)) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: `ℹ️ Plugin *${canonicalName}* memang sudah dalam keadaan aktif.` },
          { quoted: msg }
        );
        return;
      }

      db.data.settings.disabledPlugins = db.data.settings.disabledPlugins.filter(
        (p) => p !== canonicalName
      );
      db.save();

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `🟢 Plugin *${canonicalName}* berhasil DIAKTIFKAN kembali.` },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Aksi tidak valid. Gunakan: enable, disable, atau list." },
        { quoted: msg }
      );
    }
  },
};
