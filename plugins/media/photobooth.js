import { createCanvas, loadImage } from "canvas";

const photoboothSessions = new Map();

export default [
  {
    name: "addphotobooth",
    aliases: ["addpb"],
    category: "Media",
    premiumOnly: true,
    description: "Menambahkan foto ke sesi photobooth strip.",
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
        if (session.length >= 5) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Sesi photobooth penuh! Maksimal 5 foto per strip. Ketik *.makephotobooth* atau *.clearphotobooth*.",
            },
            { quoted: msg }
          );
          return;
        }

        session.push(buffer);

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `✅ Foto ke-${session.length} berhasil ditambahkan! (${session.length}/5)\n\n📌 Ketik *.addpb* lagi untuk menambah foto.\n📌 Ketik *.makepb [judul]* untuk membuat strip photobooth.\n📌 Ketik *.clearpb* untuk mereset.`,
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
    description: "Membuat strip foto photobooth imut dengan hiasan boneka beruang 🧸 selang-seling.",
    usage: "<judul opsional>",
    example: ".makepb Best Moments ♥",
    run: async (sock, msg, args, { sendTyping, senderJid }) => {
      const session = photoboothSessions.get(senderJid);

      if (!session || session.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: "⚠️ Sesi photobooth kosong! Gunakan *.addpb* (kirim/balas foto) terlebih dahulu.",
          },
          { quoted: msg }
        );
        return;
      }

      await sendTyping();
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⏳ Sedang merender strip photobooth imut..." },
        { quoted: msg }
      );

      try {
        const titleText = args.join(" ") || "Best Moments ♥";
        const dateText = `${new Date().toLocaleDateString("id-ID")} • PHOTOBOOTH`;

        // Canvas Layout Dimensions
        const photoWidth = 320;
        const photoHeight = 220;
        const paddingX = 24;
        const paddingTop = 28;
        const gapY = 16;
        const footerHeight = 80;

        const canvasWidth = photoWidth + paddingX * 2;
        const canvasHeight =
          paddingTop +
          session.length * photoHeight +
          (session.length - 1) * gapY +
          footerHeight;

        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext("2d");

        // Background Strip (White Paper)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Strip Border
        ctx.strokeStyle = "#e8ded8";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);

        // Render Photos & Bear Dolls
        for (let i = 0; i < session.length; i++) {
          const imgBuffer = session[i];
          const img = await loadImage(imgBuffer);

          const x = paddingX;
          const y = paddingTop + i * (photoHeight + gapY);

          // Draw Photo Item Container background
          ctx.fillStyle = "#f2ebe7";
          ctx.fillRect(x, y, photoWidth, photoHeight);

          // Draw Image Object-Fit Cover
          const imgRatio = img.width / img.height;
          const targetRatio = photoWidth / photoHeight;
          let sw, sh, sx, sy;

          if (imgRatio > targetRatio) {
            sh = img.height;
            sw = img.height * targetRatio;
            sx = (img.width - sw) / 2;
            sy = 0;
          } else {
            sw = img.width;
            sh = img.width / targetRatio;
            sx = 0;
            sy = (img.height - sh) / 2;
          }

          ctx.drawImage(img, sx, sy, sw, sh, x, y, photoWidth, photoHeight);

          // Add 1 Teddy Bear Doll 🧸 per photo frame in alternating pattern (Foto 1: Kiri Atas, Foto 2: Kanan Atas, Foto 3: Kiri Atas...)
          const isLeft = i % 2 === 0;
          const bx = isLeft ? x + 8 : x + photoWidth - 36;
          const by = y + 8;

          ctx.font = "28px 'Segoe UI Emoji', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          ctx.save();
          ctx.translate(bx + 14, by + 14);
          ctx.rotate(isLeft ? (-15 * Math.PI) / 180 : (15 * Math.PI) / 180);
          ctx.fillText("🧸", 0, 0);
          ctx.restore();
        }

        // Render Footer Text
        const footerY = paddingTop + session.length * photoHeight + (session.length - 1) * gapY;
        
        ctx.fillStyle = "#4a3b32";
        ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(titleText, canvasWidth / 2, footerY + 36);

        ctx.fillStyle = "#8c7a6e";
        ctx.font = "500 12px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText(dateText, canvasWidth / 2, footerY + 58);

        const resultBuffer = canvas.toBuffer("image/png");

        // Clear session after rendering
        photoboothSessions.delete(senderJid);

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: resultBuffer,
            caption: `📸 *Photobooth Strip Result*\n\n✨ Total Foto: ${session.length}\n🏷️ Judul: ${titleText}\n⚡ _Via Kyros-MD_`,
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error("Error makephotobooth:", err);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Gagal membuat strip photobooth." },
          { quoted: msg }
        );
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
    description: "Mendapatkan link web Photobooth Strip Maker interaktif.",
    run: async (sock, msg) => {
      const webUrl = "https://photoboth.rakarizqi-cv.workers.dev/photobooth";
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `📸 *Aesthetic Photobooth Strip Web App*\n\nBuka link berikut di browser untuk membuat photobooth strip imut secara langsung:\n🔗 ${webUrl}\n\n✨ *Fitur Web App*:\n• Kustomisasi 1-5 foto\n• Hiasan boneka beruang 🧸 selang-seling\n• Pilihan warna bingkai & judul footer\n• Unduh gambar PNG HD`,
        },
        { quoted: msg }
      );
    },
  },
];
