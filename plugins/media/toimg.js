export default {
  name: "toimg",
  description: "Mengubah stiker (statis atau animasi) kembali menjadi foto atau video.",
  usage: "<balas stiker>",
  example: "",
  aliases: ["toimage", "tovideo", "togif", "tomp4"],
  category: "Media",
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const { extractMessageContent, downloadMediaMessage } = await import("baileys");
    const { webpToImage, animatedWebpToMp4 } = await import("@/src/utils/media.js");

    const getMediaNode = (m) => {
      if (!m) return null;
      const content = extractMessageContent(m);
      if (!content) return null;
      const keys = Object.keys(content);

      if (keys.includes("stickerMessage")) return content;
      if (keys.includes("viewOnceMessage"))
        return getMediaNode(content.viewOnceMessage.message);
      if (keys.includes("viewOnceMessageV2"))
        return getMediaNode(content.viewOnceMessageV2.message);

      return null;
    };

    const directMedia = getMediaNode(msg.message);
    const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedMedia = getMediaNode(quotedMsg);

    if (!directMedia && !quotedMedia) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Balas stiker yang ingin Anda ubah kembali menjadi gambar/video dengan mengetik *.toimg*",
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    try {
      let mediaMessage;
      if (directMedia) {
        mediaMessage = msg;
      } else {
        const quotedInfo = msg.message.extendedTextMessage?.contextInfo;
        mediaMessage = {
          key: {
            remoteJid: msg.key.remoteJid,
            id: quotedInfo?.stanzaId,
            participant: quotedInfo?.participant,
            fromMe: false,
          },
          message: quotedMedia,
        };
      }

      const buffer = await downloadMediaMessage(
        mediaMessage,
        "buffer",
        {},
        {
          logger: {
            info: () => {},
            error: () => {},
            warn: () => {},
            debug: () => {},
            trace: () => {},
            child: () => ({
              info: () => {},
              error: () => {},
              warn: () => {},
              debug: () => {},
              trace: () => {},
            }),
          },
          reuploadRequest: sock.updateMediaMessage,
        }
      );

      const isAnimated = buffer.toString("ascii", 0, 1000).includes("ANIM");

      if (isAnimated) {
        const videoBuffer = await animatedWebpToMp4(buffer);
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            video: videoBuffer,
            caption: "✨ Berhasil mengubah stiker animasi menjadi video.",
            mimetype: "video/mp4",
          },
          { quoted: msg }
        );
      } else {
        const imageBuffer = await webpToImage(buffer);
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: imageBuffer,
            caption: "✨ Berhasil mengubah stiker menjadi gambar.",
            mimetype: "image/png",
          },
          { quoted: msg }
        );
      }
    } catch (err) {
      console.error("[ToImg Error]", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal mengubah stiker: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};
