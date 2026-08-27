import fs from "fs";
import path from "path";

export default {
  name: "addplugin",
  description: "Menambahkan atau memperbarui file plugin JS secara langsung.",
  usage: "<path> <kode>",
  aliases: ["sp", "saveplugin", "ap"],
  category: "Owner",
  superOwnerOnly: true,
  ownerOnly: true,
  run: async (sock, msg, args, { activePrefix, sendTyping }) => {
    await sendTyping();
    const remoteJid = msg.key.remoteJid;

    let code = args.slice(1).join(" ");
    const targetPathInput = args[0];

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted) {
      code = quoted.conversation || quoted.extendedTextMessage?.text || code;
    }

    if (!targetPathInput || !code) {
      await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ *Format salah!*\n\nContoh:\n\`${activePrefix}addplugin plugins/downloader/tes.js <kode>\`\natau balas pesan kode dengan:\n\`${activePrefix}addplugin plugins/downloader/tes.js\``,
        },
        { quoted: msg }
      );
      return;
    }

    const projectRoot = process.cwd();
    const absolutePath = path.resolve(projectRoot, targetPathInput);

    const isUnderPlugins = absolutePath.startsWith(
      path.join(projectRoot, "plugins") + path.sep
    );

    if (!isUnderPlugins) {
      await sock.sendMessage(
        remoteJid,
        { text: "❌ *Akses ditolak:* File hanya diizinkan di dalam folder `plugins/`!" },
        { quoted: msg }
      );
      return;
    }

    if (!targetPathInput.endsWith(".js")) {
      await sock.sendMessage(
        remoteJid,
        { text: "❌ *Tipe tidak valid:* File harus berekstensi `.js`!" },
        { quoted: msg }
      );
      return;
    }

    try {
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(absolutePath, code, "utf-8");
      await sock.sendMessage(
        remoteJid,
        {
          text: `✅ *Berhasil:* Plugin berhasil disimpan di \`${targetPathInput}\` dan akan dimuat secara otomatis.`,
        },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        remoteJid,
        { text: `❌ *Gagal menyimpan file:*\n${err.message}` },
        { quoted: msg }
      );
    }
  },
};
