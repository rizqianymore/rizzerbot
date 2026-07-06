export default {
  name: "rvo",
  description:
    "Membaca / mengambil kembali media pesan sekali lihat (View Once).",
  usage: "<balas pesan sekali lihat>",
  example: "",
  aliases: ["readviewonce", "retrieveviewonce"],
  category: "Media",
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const { extractMessageContent } = await import("baileys");

    const getMediaNode = (m) => {
      if (!m) return null;
      const content = extractMessageContent(m);
      if (!content) return null;
      const keys = Object.keys(content);

      const hasMedia =
        keys.includes("imageMessage") ||
        keys.includes("videoMessage") ||
        keys.includes("audioMessage") ||
        keys.includes("stickerMessage") ||
        (keys.includes("documentMessage") &&
          (content.documentMessage.mimetype?.startsWith("image/") ||
            content.documentMessage.mimetype?.startsWith("video/")));

      if (hasMedia) return content;

      if (keys.includes("viewOnceMessage"))
        return getMediaNode(content.viewOnceMessage.message);
      if (keys.includes("viewOnceMessageV2"))
        return getMediaNode(content.viewOnceMessageV2.message);
      if (keys.includes("viewOnceMessageV2Extension"))
        return getMediaNode(content.viewOnceMessageV2Extension.message);

      return null;
    };

    const quotedMsg =
      msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Balas pesan sekali lihat (View Once) yang ingin Anda ambil medianya.",
        },
        { quoted: msg },
      );
      return;
    }

    const mediaNode = getMediaNode(quotedMsg);
    if (!mediaNode) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Pesan yang Anda balas bukan merupakan media sekali lihat (View Once).",
        },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();

    try {
      const { downloadMediaMessage } = await import("baileys");

      const quotedInfo = msg.message.extendedTextMessage?.contextInfo;
      const mediaMessage = {
        key: {
          remoteJid: msg.key.remoteJid,
          id: quotedInfo?.stanzaId,
          participant: quotedInfo?.participant,
          fromMe: false,
        },
        message: mediaNode,
      };

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
        },
      );

      if (mediaNode.imageMessage) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: buffer,
            caption: mediaNode.imageMessage.caption || "",
          },
          { quoted: msg },
        );
      } else if (mediaNode.videoMessage) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            video: buffer,
            caption: mediaNode.videoMessage.caption || "",
          },
          { quoted: msg },
        );
      } else if (mediaNode.audioMessage) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            audio: buffer,
            mimetype: mediaNode.audioMessage.mimetype || "audio/mp4",
            ptt: mediaNode.audioMessage.ptt || false,
          },
          { quoted: msg },
        );
      } else if (mediaNode.documentMessage) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            document: buffer,
            mimetype: mediaNode.documentMessage.mimetype,
            fileName: mediaNode.documentMessage.fileName || "file",
          },
          { quoted: msg },
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "⚠️ Tipe media tidak didukung." },
          { quoted: msg },
        );
      }
    } catch (err) {
      console.error("[RVO Error]", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal mengambil media sekali lihat: ${err.message}` },
        { quoted: msg },
      );
    }
  },
};
