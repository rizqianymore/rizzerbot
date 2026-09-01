import { fetchBuffer } from "@/src/utils/scraping.js";

const photoboothSessions = new Map();

async function uploadToTmpFiles(buffer, mimeType = "image/png") {
  const form = new FormData();
  const file = new Blob([buffer], { type: mimeType });
  form.append("file", file, "photo.png");

  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (data.status === "success" && data.data?.url) {
    return data.data.url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
  }
  throw new Error("Gagal mengunggah foto ke temporary cloud hosting.");
}

export default [
  {
    name: "addphotobooth",
    aliases: ["addpb"],
    category: "Media",
    premiumOnly: true,
    description: "Menambahkan foto ke sesi photobooth strip (Maksimal 12 foto).",
    usage: "<kirim/balas gambar>",
    run: async (sock, msg, args, { sendTyping, senderJid }) => {
      const { extractMessageContent, downloadMediaMessage } = await import("baileys");

      const getMediaNode = (m) => {
        if (!m) return null;
        const content = extractMessageContent(m);
        if (!content) return null;
        const keys = Object.keys(content);
        const hasImage =
          keys.includes("imageMessage") ||
          (keys.includes("documentMessage") &&
            content.documentMessage.mimetype?.startsWith("image/"));
        if (hasImage) return content;
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

      if (!directMedia && !quotedMedia) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: "⚠️ Kirim atau balas gambar dengan perintah *.addpb* untuk menambahkan foto ke photobooth.",
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
          const quotedInfo = msg.message.extendedTextMessage.contextInfo;
          mediaMessage = {
            key: {
              remoteJid: msg.key.remoteJid,
              id: quotedInfo.stanzaId,
              participant: quotedInfo.participant,
              fromMe: false,
            },
            message: quotedMsg,
          };
        }

        const buffer = await downloadMediaMessage(mediaMessage, "buffer", {});

        if (!photoboothSessions.has(senderJid)) {
          photoboothSessions.set(senderJid, []);
        }

        const session = photoboothSessions.get(senderJid);
        if (session.length >= 12) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Sesi photobooth penuh! Maksimal 12 foto per sesi. Ketik *.makepb* atau *.clearpb*.",
            },
            { quoted: msg }
          );
          return;
        }

        session.push(buffer);

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text:
              `✅ Foto ke-${session.length} berhasil ditambahkan! (${session.length}/12)\n\n` +
              `📌 Ketik *.addpb* lagi untuk menambah foto.\n` +
              `📌 Ketik *.makepb [opsi]* untuk membuat photobooth.\n` +
              `📌 Ketik *.clearpb* untuk mereset sesi.`,
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error("Error addphotobooth:", err);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Gagal mengunduh atau menambahkan foto." },
          { quoted: msg }
        );
      }
    },
  },
  {
    name: "makephotobooth",
    aliases: ["makepb", "photobooth", "pb"],
    category: "Media",
    premiumOnly: true,
    description:
      "Membuat photobooth strip / grid berkualitas HD menggunakan API Worker.",
    usage: "[judul] [--theme cream/black/pink] [--sticker bear/star/heart] [--layout vertical/grid-2/custom] [--cols 2] [--rows 3]",
    example: ".makepb Liburan Seru --theme cream --sticker bear --layout grid-2",
    run: async (sock, msg, args, { sendTyping, senderJid, activePrefix }) => {
      const session = photoboothSessions.get(senderJid);

      if (!session || session.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text:
              `⚠️ Sesi photobooth kosong!\n\n` +
              `Kirim/balas foto dengan \`${activePrefix}addpb\` terlebih dahulu minimal 1 foto.`,
          },
          { quoted: msg }
        );
        return;
      }

      await sendTyping();

      const loadingMsg = await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `⏳ Sedang mengunggah ${session.length} foto & merender photobooth HD...`,
        },
        { quoted: msg }
      );

      try {
        // Parse options from args
        let rawText = args.join(" ");
        let theme = "cream";
        let sticker = "bear";
        let layout = session.length > 4 ? "grid-2" : "vertical";
        let cols = "";
        let rows = "";
        let date = new Date().toLocaleDateString("id-ID");

        const themeMatch = rawText.match(/--theme\s+([a-zA-Z0-9_-]+)/i);
        if (themeMatch) {
          theme = themeMatch[1].toLowerCase();
          rawText = rawText.replace(themeMatch[0], "");
        }

        const stickerMatch = rawText.match(/--sticker\s+([a-zA-Z0-9_-]+)/i);
        if (stickerMatch) {
          sticker = stickerMatch[1].toLowerCase();
          rawText = rawText.replace(stickerMatch[0], "");
        }

        const layoutMatch = rawText.match(/--layout\s+([a-zA-Z0-9_-]+)/i);
        if (layoutMatch) {
          layout = layoutMatch[1].toLowerCase();
          rawText = rawText.replace(layoutMatch[0], "");
        }

        const colsMatch = rawText.match(/--cols\s+(\d+)/i);
        if (colsMatch) {
          cols = colsMatch[1];
          rawText = rawText.replace(colsMatch[0], "");
        }

        const rowsMatch = rawText.match(/--rows\s+(\d+)/i);
        if (rowsMatch) {
          rows = rowsMatch[1];
          rawText = rawText.replace(rowsMatch[0], "");
        }

        const title = rawText.trim() || "Best Moments ♥";

        // 1. Upload session photos to temporary hosting
        const uploadedPhotoUrls = [];
        for (let i = 0; i < session.length; i++) {
          const url = await uploadToTmpFiles(session[i]);
          uploadedPhotoUrls.push(url);
        }

        // 2. Build Worker API URL
        const workerBase = "https://photoboth.rakarizqi-cv.workers.dev/";
        const params = new URLSearchParams();

        if (layout) params.append("layout", layout);
        if (cols) params.append("cols", cols);
        if (rows) params.append("rows", rows);
        params.append("title", title);
        params.append("date", date);
        params.append("theme", theme);
        params.append("sticker", sticker);
        params.append("photos", uploadedPhotoUrls.join(","));

        const targetWorkerUrl = `${workerBase}?${params.toString()}`;

        // 3. Capture with Microlink Screenshot API
        const microUrl = `https:
          targetWorkerUrl
        )}&screenshot=true&embed=screenshot.url&waitForTimeout=2500`;

        const resultBuffer = await fetchBuffer(microUrl, { timeout: 25000 });

        // Clear session after success
        photoboothSessions.delete(senderJid);

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: resultBuffer,
            caption:
              `📸 *Photobooth Result*\n\n` +
              `├─ ✨ *Total Foto:* ${uploadedPhotoUrls.length}\n` +
              `├─ 🏷️ *Judul:* ${title}\n` +
              `├─ 🎨 *Tema:* ${theme}\n` +
              `└─ 🧸 *Stiker:* ${sticker}\n\n` +
              `⚡ _Generated via Photobooth Worker_`,
          },
          { quoted: msg }
        );

        // Edit loading message
        await sock.sendMessage(msg.key.remoteJid, {
          text: "✅ Photobooth berhasil dibuat!",
          edit: loadingMsg.key,
        });
      } catch (err) {
        console.error("Error makephotobooth:", err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❌ Gagal merender photobooth: ${err.message}`,
          edit: loadingMsg.key,
        });
      }
    },
  },
  {
    name: "clearphotobooth",
    aliases: ["clearpb"],
    category: "Media",
    premiumOnly: true,
    description: "Mereset atau menghapus sesi foto photobooth.",
    run: async (sock, msg, args, { senderJid }) => {
      photoboothSessions.delete(senderJid);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "🗑️ Sesi photobooth Anda telah dibersihkan." },
        { quoted: msg }
      );
    },
  },
  {
    name: "webphotobooth",
    aliases: ["webpb", "linkpb", "photoboothweb"],
    category: "Media",
    premiumOnly: true,
    description: "Mendapatkan link web Photobooth Maker interaktif.",
    run: async (sock, msg) => {
      const webUrl = "https://photoboth.rakarizqi-cv.workers.dev/";
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `📸 *Aesthetic Photobooth Strip & Grid Web App*\n\n` +
            `Buka link berikut di browser untuk mendesain photobooth kustom:\n🔗 ${webUrl}\n\n` +
            `✨ *Parameter URL API*:\n` +
            `• \`?layout=vertical / grid-2 / custom\`\n` +
            `• \`?theme=cream / black / pink\`\n` +
            `• \`?sticker=bear / star / heart\`\n` +
            `• \`?title=Judul&date=Tanggal\`\n` +
            `• \`?photos=link1.jpg,link2.jpg\``,
        },
        { quoted: msg }
      );
    },
  },
];
