import { getViewOnceFromVault } from "@/src/middleware/viewOnceVault.js";

export default {
  name: "rvo",
  description:
    "Membaca / mengambil kembali media pesan sekali lihat (View Once) secara instan via Vault/Reply.",
  usage: "[balas pesan sekali lihat]",
  example: "rvo",
  aliases: ["readviewonce", "retrieveviewonce", "rvovault"],
  category: "Media",
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping, activePrefix }) => {
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

    const quotedInfo = msg.message.extendedTextMessage?.contextInfo;
    const quotedMsg = quotedInfo?.quotedMessage;
    const stanzaId = quotedInfo?.stanzaId;

    // 1. Coba ambil langsung dari background in-memory vault
    const vaultItem = stanzaId ? getViewOnceFromVault(stanzaId) : getViewOnceFromVault(msg.key.remoteJid);

    if (vaultItem && (!quotedMsg || !getMediaNode(quotedMsg))) {
      await sendTyping();
      const captionText =
        `👁️ *[VIEW-ONCE RECOVERED]*\n` +
        `• Pengirim: @${vaultItem.senderNum}\n` +
        `• Waktu: ${new Date(vaultItem.timestamp).toLocaleTimeString("id-ID")}` +
        (vaultItem.caption ? `\n• Caption: ${vaultItem.caption}` : "");

      if (vaultItem.mediaType === "image") {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { image: vaultItem.buffer, caption: captionText, mentions: [vaultItem.participant] },
          { quoted: msg }
        );
      } else if (vaultItem.mediaType === "video") {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { video: vaultItem.buffer, caption: captionText, mentions: [vaultItem.participant] },
          { quoted: msg }
        );
      } else if (vaultItem.mediaType === "audio") {
        return await sock.sendMessage(
          msg.key.remoteJid,
          { audio: vaultItem.buffer, mimetype: vaultItem.mimetype, ptt: true },
          { quoted: msg }
        );
      }
    }

    if (!quotedMsg) {
      return await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `⚠️ *Penggunaan RVO (Retrieve View Once)*\n\n` +
            `• Balas (*reply*) pesan View Once lalu ketik \`${activePrefix}rvo\`\n` +
            `• Atau ketik \`${activePrefix}rvo\` jika pesan View Once baru saja dikirim di chat ini (Auto-Vault Recovery).`,
        },
        { quoted: msg }
      );
    }

    const mediaNode = getMediaNode(quotedMsg);
    if (!mediaNode) {
      return await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Pesan yang Anda balas bukan merupakan media sekali lihat (View Once).",
        },
        { quoted: msg }
      );
    }

    await sendTyping();

    try {
      const { downloadMediaMessage } = await import("baileys");

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
        }
      );

      if (mediaNode.imageMessage) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: buffer,
            caption: mediaNode.imageMessage.caption || "",
          },
          { quoted: msg }
        );
      } else if (mediaNode.videoMessage) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            video: buffer,
            caption: mediaNode.videoMessage.caption || "",
          },
          { quoted: msg }
        );
      } else if (mediaNode.audioMessage) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            audio: buffer,
            mimetype: mediaNode.audioMessage.mimetype || "audio/mp4",
            ptt: mediaNode.audioMessage.ptt || false,
          },
          { quoted: msg }
        );
      } else if (mediaNode.documentMessage) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            document: buffer,
            mimetype: mediaNode.documentMessage.mimetype,
            fileName: mediaNode.documentMessage.fileName || "file",
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "⚠️ Tipe media tidak didukung." },
          { quoted: msg }
        );
      }
    } catch (err) {
      console.error("[RVO Error]", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal mengambil media sekali lihat: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};
