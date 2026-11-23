import {
  downloadGoogleDrive,
  downloadTerabox,
  downloadPixeldrain,
  isGoogleDriveUrl,
  isTeraboxUrl,
  isPixeldrainUrl,
} from "@/src/services/fetch/cloud.js";

export default {
  name: "gdrive",
  cooldownMs: 15000,
  aliases: ["gd", "gdown", "terabox", "td", "pixeldrain", "pdl", "cloud", "gdrivedl"],
  description: "Unduh file langsung dari link publik Google Drive, Terabox, atau Pixeldrain.",
  usage: "<url>",
  category: "Downloader & Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
    await sendTyping();

    const url = (args[0] || "").trim();
    const currentPrefix = prefix || ".";
    const remoteJid = msg.key.remoteJid;

    if (!url || !/^https?:\/\//i.test(url)) {
      return reply(
        `*CLOUD STORAGE DOWNLOADER*\n\n` +
          `Masukkan link publik file storage:\n` +
          `│ \`${currentPrefix}gdrive https://drive.google.com/file/d/xxxxxx/view\`\n` +
          `│ \`${currentPrefix}pixeldrain https://pixeldrain.com/u/xxxxxx\`\n` +
          `│ \`${currentPrefix}terabox https://terabox.com/s/xxxxxx\``
      );
    }

    const terabox = isTeraboxUrl(url);
    const drive = isGoogleDriveUrl(url);
    const pixeldrain = isPixeldrainUrl(url);

    if (!terabox && !drive && !pixeldrain) {
      return reply("Link harus dari Google Drive, Pixeldrain (pixeldrain.com), atau Terabox.");
    }

    try {
      let result;
      if (pixeldrain) {
        result = await downloadPixeldrain(url, logger);
      } else if (terabox) {
        result = await downloadTerabox(url, logger);
      } else {
        result = await downloadGoogleDrive(url, logger);
      }

      const sizeMb = (result.buffer.length / 1024 / 1024).toFixed(2);
      await sock.sendMessage(
        remoteJid,
        {
          document: result.buffer,
          fileName: result.fileName,
          mimetype: result.mime,
          caption: `Berhasil mengunduh *${result.fileName}* (${sizeMb} MB)`,
        },
        { quoted: msg }
      );
    } catch (err) {
      logger?.warn?.(`[cloud] ${err?.message || err}`);
      await reply(`Gagal mengunduh: ${err?.message || "File tidak ditemukan atau link tidak publik."}`);
    }
  },
};
