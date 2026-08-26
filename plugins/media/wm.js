import { settings } from "@/config/settings.js";

export default {
  name: "wm",
  description: "Mengubah metadata / watermark (Pack Name & Author) pada stiker.",
  usage: "<packname> | <author>",
  example: "Kyros Pack | Pentagon",
  aliases: ["take", "colong", "steal", "wmsticker", "swm"],
  category: "Media",
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    const { extractMessageContent, downloadMediaMessage } = await import("baileys");
    const { addStickerMetadata } = await import("@/src/services/sticker.js");
    const { tokenize } = await import("@/src/utils/emoji.js");

    const getMediaNode = (m) => {
      if (!m) return null;
      const content = extractMessageContent(m);
      if (!content) return null;
      const keys = Object.keys(content);

      if (
        keys.includes("stickerMessage") ||
        keys.includes("imageMessage") ||
        keys.includes("videoMessage")
      ) {
        return content;
      }
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
          text: "⚠️ Balas stiker atau gambar dengan *.wm <Pack> | <Author>* untuk mengganti watermark stiker.",
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    const text = args.join(" ").trim();
    let packName = settings.stickerPackName;
    let author = settings.stickerAuthor;

    if (text.includes("|")) {
      const parts = text.split("|");
      packName = parts[0].trim() || packName;
      author = parts[1].trim() || author;
    } else if (text) {
      packName = text;
      author = "";
    }

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

      let buffer = await downloadMediaMessage(
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

      const mediaNode = directMedia || quotedMedia;
      const isVideo = !!(
        mediaNode.videoMessage ||
        (mediaNode.documentMessage &&
          mediaNode.documentMessage.mimetype?.startsWith("video/"))
      );

      const tokens = tokenize(text);
      const extractedEmojis = [
        ...new Set(tokens.filter((t) => t.type === "emoji").map((t) => t.value)),
      ];
      const emojiParam = extractedEmojis.length > 0 ? extractedEmojis : undefined;

      buffer = await addStickerMetadata(
        buffer,
        packName,
        author,
        isVideo,
        emojiParam
      );

      await sock.sendMessage(
        msg.key.remoteJid,
        { sticker: buffer, mimetype: "image/webp" },
        { quoted: msg }
      );
    } catch (err) {
      console.error("[WM Error]", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal mengubah metadata stiker: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};
