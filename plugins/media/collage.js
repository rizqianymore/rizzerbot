import { createCanvas, loadImage } from "canvas";

const collageSessions = new Map();

export default [
  {
    name: "addkolase",
    category: "Media",
    premiumOnly: true,
    run: async (sock, msg, args, { sendTyping, senderJid }) => {
      const { extractMessageContent, downloadMediaMessage } =
        await import("baileys");

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
            text: "⚠️ Kirim atau balas gambar dengan perintah *.addkolase* untuk menambahkannya ke sesi.",
          },
          { quoted: msg },
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

        if (!collageSessions.has(senderJid)) {
          collageSessions.set(senderJid, []);
        }
        const session = collageSessions.get(senderJid);
        if (session.length >= 9) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Maksimal 9 gambar yang bisa ditambahkan. Ketik *.kolase* untuk menggabungkannya.",
            },
            { quoted: msg },
          );
          return;
        }

        session.push(buffer);
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `✅ Gambar berhasil ditambahkan! [Total: ${session.length}/9]\nKirim gambar lain dengan *.addkolase* atau ketik *.kolase* untuk memproses.`,
          },
          { quoted: msg },
        );
      } catch (err) {
        console.error("Add Kolase Error:", err);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Gagal mengambil gambar." },
          { quoted: msg },
        );
      }
    },
  },
  {
    name: "kolase",
    category: "Media",
    premiumOnly: true,
    run: async (sock, msg, args, { sendTyping, senderJid }) => {
      const session = collageSessions.get(senderJid);
      if (!session || session.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: "⚠️ Anda belum menambahkan gambar. Kirim atau balas gambar dengan perintah *.addkolase* terlebih dahulu.",
          },
          { quoted: msg },
        );
        return;
      }

      await sendTyping();
      try {
        const images = await Promise.all(session.map((buf) => loadImage(buf)));

        const baseWidth = 1080;
        const baseHeight = 1080;
        const scaleFactor = 2;

        const canvasWidth = baseWidth * scaleFactor;
        const canvasHeight = baseHeight * scaleFactor;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext("2d");
        ctx.scale(scaleFactor, scaleFactor);

        const logicalWidth = baseWidth;
        const logicalHeight = baseHeight;

        const bgImage = images[0];

        const scale = Math.max(
          logicalWidth / bgImage.width,
          logicalHeight / bgImage.height,
        );
        const x = logicalWidth / 2 - (bgImage.width / 2) * scale;
        const y = logicalHeight / 2 - (bgImage.height / 2) * scale;

        ctx.filter = "blur(30px)";
        ctx.drawImage(
          bgImage,
          x,
          y,
          bgImage.width * scale,
          bgImage.height * scale,
        );
        ctx.filter = "none";

        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        const overlayMargin = 60;
        const overlayW = logicalWidth - overlayMargin * 2;
        const overlayH = logicalHeight - overlayMargin * 2;

        const radius = 30;
        ctx.beginPath();
        ctx.moveTo(overlayMargin + radius, overlayMargin);
        ctx.lineTo(overlayMargin + overlayW - radius, overlayMargin);
        ctx.quadraticCurveTo(
          overlayMargin + overlayW,
          overlayMargin,
          overlayMargin + overlayW,
          overlayMargin + radius,
        );
        ctx.lineTo(overlayMargin + overlayW, overlayMargin + overlayH - radius);
        ctx.quadraticCurveTo(
          overlayMargin + overlayW,
          overlayMargin + overlayH,
          overlayMargin + overlayW - radius,
          overlayMargin + overlayH,
        );
        ctx.lineTo(overlayMargin + radius, overlayMargin + overlayH);
        ctx.quadraticCurveTo(
          overlayMargin,
          overlayMargin + overlayH,
          overlayMargin,
          overlayMargin + overlayH - radius,
        );
        ctx.lineTo(overlayMargin, overlayMargin + radius);
        ctx.quadraticCurveTo(
          overlayMargin,
          overlayMargin,
          overlayMargin + radius,
          overlayMargin,
        );
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.stroke();

        const count = images.length;
        let cols = 1;
        let rows = 1;
        if (count == 2) {
          cols = 2;
          rows = 1;
        } else if (count <= 4) {
          cols = 2;
          rows = 2;
        } else if (count <= 6) {
          cols = 3;
          rows = 2;
        } else {
          cols = 3;
          rows = 3;
        }

        const gap = 20;
        const gridPadding = 40;
        const availableW = overlayW - gridPadding * 2;
        const availableH = overlayH - gridPadding * 2;

        const cellW = (availableW - gap * (cols - 1)) / cols;
        const cellH = (availableH - gap * (rows - 1)) / rows;

        for (let i = 0; i < count; i++) {
          const c = i % cols;
          const r = Math.floor(i / cols);

          const cellX = overlayMargin + gridPadding + c * (cellW + gap);
          const cellY = overlayMargin + gridPadding + r * (cellH + gap);

          const img = images[i];

          const imgScale = Math.max(cellW / img.width, cellH / img.height);
          const drawW = img.width * imgScale;
          const drawH = img.height * imgScale;
          const drawX = cellX + cellW / 2 - drawW / 2;
          const drawY = cellY + cellH / 2 - drawH / 2;

          ctx.save();
          ctx.beginPath();

          const cellRadius = 15;
          ctx.moveTo(cellX + cellRadius, cellY);
          ctx.lineTo(cellX + cellW - cellRadius, cellY);
          ctx.quadraticCurveTo(
            cellX + cellW,
            cellY,
            cellX + cellW,
            cellY + cellRadius,
          );
          ctx.lineTo(cellX + cellW, cellY + cellH - cellRadius);
          ctx.quadraticCurveTo(
            cellX + cellW,
            cellY + cellH,
            cellX + cellW - cellRadius,
            cellY + cellH,
          );
          ctx.lineTo(cellX + cellRadius, cellY + cellH);
          ctx.quadraticCurveTo(
            cellX,
            cellY + cellH,
            cellX,
            cellY + cellH - cellRadius,
          );
          ctx.lineTo(cellX, cellY + cellRadius);
          ctx.quadraticCurveTo(cellX, cellY, cellX + cellRadius, cellY);
          ctx.closePath();

          ctx.clip();
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
        }

        const buffer = canvas.toBuffer("image/jpeg", { quality: 0.9 });
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: buffer, caption: "✨ Kolase Glassmorphism" },
          { quoted: msg },
        );

        collageSessions.delete(senderJid);
      } catch (err) {
        console.error("Kolase Error:", err);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Gagal membuat kolase." },
          { quoted: msg },
        );
      }
    },
  },
  {
    name: "cancelkolase",
    category: "Media",
    premiumOnly: true,
    run: async (sock, msg, args, { senderJid }) => {
      if (collageSessions.has(senderJid)) {
        collageSessions.delete(senderJid);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "✅ Sesi pembuatan kolase telah dibatalkan." },
          { quoted: msg },
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "⚠️ Anda tidak sedang membuat kolase." },
          { quoted: msg },
        );
      }
    },
  },
];
