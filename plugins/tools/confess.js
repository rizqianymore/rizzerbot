import { extractMessageContent } from "baileys";
import { fetchBuffer } from "@/src/utils/scraping.js";

export default {
  premiumOnly: true,
  name: "confess",
  aliases: ["confesscard", "lovecard", "menfess"],
  description:
    "Membuat kartu ucapan / pengakuan cinta (love confession card) rahasia yang cantik via API.",
  usage: "<untuk> | <pesan> | <dari> [--theme pink/blue/purple]",
  example:
    "Alya | Aku suka kamu sejak pertama kali kita sekelompok tugas | Rahasia --theme purple",
  category: "Tools",
  cooldown: 5000,
  run: async (sock, msg, args, { sendTyping, senderName, activePrefix }) => {
    let text = args.join(" ");
    if (!text) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `⚠️ *Penggunaan Salah!*\n\n` +
            `Format: *${activePrefix || "."}confess Untuk | Pesan | Dari*\n` +
            `Contoh: *${activePrefix || "."}confess Dia | Aku sayang kamu | Anonim*\n\n` +
            `💡 *Opsi Tema:* Tambahkan \`--theme pink\`, \`--theme blue\`, atau \`--theme purple\` (default: \`pink\`).\n` +
            `💡 *Foto:* Balas/quote gambar saat mengirim perintah untuk menambahkan foto ke dalam kartu.`,
        },
        { quoted: msg },
      );
      return;
    }

    // Parse theme from text
    let theme = "pink";
    const themeFlagRegex = /--theme\s+(pink|blue|purple)\b/i;
    const matchFlag = text.match(themeFlagRegex);
    if (matchFlag) {
      theme = matchFlag[1].toLowerCase();
      text = text.replace(themeFlagRegex, "").trim();
    } else {
      const themeRegex = /--(pink|blue|purple)\b/i;
      const match = text.match(themeRegex);
      if (match) {
        theme = match[1].toLowerCase();
        text = text.replace(themeRegex, "").trim();
      }
    }

    let to = "";
    let message = "";
    let from = senderName;

    const parts = text.split("|").map((p) => p.trim());
    if (parts.length >= 2) {
      to = parts[0];
      message = parts[1];
      if (parts[2]) from = parts[2];
      if (
        parts[3] &&
        ["pink", "blue", "purple"].includes(parts[3].toLowerCase())
      ) {
        theme = parts[3].toLowerCase();
      }
    } else {
      const commaParts = text.split(",").map((p) => p.trim());
      if (commaParts.length >= 2) {
        to = commaParts[0];
        message = commaParts[1];
        if (commaParts[2]) from = commaParts[2];
        if (
          commaParts[3] &&
          ["pink", "blue", "purple"].includes(commaParts[3].toLowerCase())
        ) {
          theme = commaParts[3].toLowerCase();
        }
      } else {
        to = "Seseorang";
        message = text.trim();
      }
    }

    if (!to || !message) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Harap masukkan minimal penerima dan pesan. Contoh: *.confess Kamu | Aku suka kamu*",
        },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();

    // Check if there is an image to download
    let photoUrl = "";
    try {
      const getMediaNode = (m) => {
        if (!m) return null;
        const content = extractMessageContent(m);
        if (!content) return null;
        const keys = Object.keys(content);
        const hasMedia =
          keys.includes("imageMessage") ||
          (keys.includes("documentMessage") &&
            content.documentMessage.mimetype?.startsWith("image/"));

        if (hasMedia) return content;

        if (keys.includes("viewOnceMessage"))
          return getMediaNode(content.viewOnceMessage.message);
        if (keys.includes("viewOnceMessageV2"))
          return getMediaNode(content.viewOnceMessageV2.message);

        return null;
      };

      const directMedia = getMediaNode(msg.message);
      const quotedMsg =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedMedia = getMediaNode(quotedMsg);

      if (directMedia || quotedMedia) {
        const { downloadMediaMessage } = await import("baileys");

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
          },
        );

        if (buffer) {
          let mimeType = "image/png";
          const mediaNode = directMedia || quotedMedia;
          if (mediaNode?.imageMessage?.mimetype) {
            mimeType = mediaNode.imageMessage.mimetype;
          } else if (mediaNode?.documentMessage?.mimetype) {
            mimeType = mediaNode.documentMessage.mimetype;
          }

          // Upload to tmpfiles
          const form = new FormData();
          const file = new Blob([buffer], { type: mimeType });
          form.append("file", file, "image.png");

          const uploadRes = await fetch("https://tmpfiles.org/api/v1/upload", {
            method: "POST",
            body: form,
          });
          const uploadData = await uploadRes.json();
          if (uploadData.status === "success" && uploadData.data?.url) {
            photoUrl = uploadData.data.url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
          }
        }
      }
    } catch (err) {
      console.error("Gagal mendownload/upload gambar terlampir:", err);
    }

    try {
      const baseUrl = "https://confest-api.rakarizqi-cv.workers.dev/card";
      const params = new URLSearchParams({
        to,
        message,
        from,
        theme,
      });
      if (photoUrl) {
        params.append("photo", photoUrl);
      }

      const cardUrl = `${baseUrl}?${params.toString()}`;
      const microUrl = `https://api.microlink.io?url=${encodeURIComponent(
        cardUrl
      )}&screenshot=true&embed=screenshot.url&element=.card&waitForTimeout=500`;

      const imgBuffer = await fetchBuffer(microUrl);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: imgBuffer,
          caption:
            `💝 *Love Confession Card Baru!*\n\n` +
            `💌 *Untuk:* _${to}_\n` +
            `👤 *Dari:* _${from}_\n` +
            `🎨 *Tema:* _${theme}_\n` +
            `📸 *Foto:* _${photoUrl ? "Ya (Dilampirkan)" : "Tidak"}\n\n` +
            `*Pesan:* "${message}"\n\n` +
            `⚡ _Via Kyros-MD API_`,
        },
        { quoted: msg },
      );
    } catch (err) {
      console.error("Confess Card Generation Error:", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ Gagal membuat kartu pengakuan cinta.\nDetail: ${err.message}`,
        },
        { quoted: msg },
      );
    }
  },
};
