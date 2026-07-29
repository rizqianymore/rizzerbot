import { createCanvas, loadImage } from "canvas";

const postcardSessions = new Map();

export default [
  {
    name: "addpostcard",
    aliases: ["addkartupos", "addpc"],
    category: "Media",
    premiumOnly: true,
    description: "Menambahkan foto ke sesi kartu pos romantis.",
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
            text: "⚠️ Kirim atau balas gambar dengan perintah *.addpc* untuk menambahkan foto ke kartu pos.",
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

        if (!postcardSessions.has(senderJid)) {
          postcardSessions.set(senderJid, []);
        }

        const session = postcardSessions.get(senderJid);
        if (session.length >= 4) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              text: "⚠️ Sesi kartu pos penuh! Maksimal 4 foto per kartu pos. Ketik *.makepostcard [pesan]* atau *.clearpc*.",
            },
            { quoted: msg }
          );
          return;
        }

        session.push(buffer);

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `✅ Foto ke-${session.length} berhasil ditambahkan! (${session.length}/4)\n\n📌 Ketik *.addpc* untuk menambah foto.\n📌 Ketik *.makepostcard [pesan]* untuk membuat kartu pos romantis.\n📌 Ketik *.clearpc* untuk mereset.`,
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error("Error addpostcard:", err);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Gagal mengunduh atau menambahkan foto." },
          { quoted: msg }
        );
      }
    },
  },
  {
    name: "makepostcard",
    aliases: ["makepc", "postcard", "kartupos"],
    category: "Media",
    premiumOnly: true,
    description: "Membuat kartu pos romantis hangat dengan foto dan pesan singkat.",
    usage: "<pesan singkat>",
    example: ".makepc Selamat ulang tahun sayang ♥ | Untuk: Kamu | Dari: Aku",
    run: async (sock, msg, args, { sendTyping, senderJid }) => {
      const session = postcardSessions.get(senderJid);

      if (!session || session.length === 0) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: "⚠️ Sesi kartu pos kosong! Gunakan *.addpc* (kirim/balas foto) terlebih dahulu.",
          },
          { quoted: msg }
        );
        return;
      }

      await sendTyping();
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "⏳ Sedang merender kartu pos romantis..." },
        { quoted: msg }
      );

      try {
        const fullText = args.join(" ") || "Menyimpan kenangan indah bersama kamu... ♥";
        const parts = fullText.split("|").map((p) => p.trim());
        const bodyMsg = parts[0] || "Menyimpan kenangan indah bersama kamu... ♥";
        const toText = parts[1] || "Untuk: Seseorang yang Spesial";
        const fromText = parts[2] || "Dari: Dengan Cinta";

        // Postcard Canvas Dimensions
        const width = 800;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // Background Warm Paper Color
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // Border Line Outer
        ctx.strokeStyle = "#e8ded8";
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        // Divider Line (Left: Photo Grid, Right: Message Area)
        const leftWidth = 420;
        ctx.beginPath();
        ctx.moveTo(leftWidth, 20);
        ctx.lineTo(leftWidth, height - 20);
        ctx.strokeStyle = "#f0e6e0";
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- Render Photos on Left Section ---
        const photoCount = session.length;
        const pMargin = 24;
        const gridW = leftWidth - pMargin * 2;
        const gridH = height - pMargin * 2;

        if (photoCount === 1) {
          const img = await loadImage(session[0]);
          drawCover(ctx, img, pMargin, pMargin, gridW, gridH);
        } else if (photoCount === 2) {
          const subH = (gridH - 12) / 2;
          for (let i = 0; i < 2; i++) {
            const img = await loadImage(session[i]);
            drawCover(ctx, img, pMargin, pMargin + i * (subH + 12), gridW, subH);
          }
        } else if (photoCount === 3) {
          const subW = (gridW - 10) / 2;
          const subH = (gridH - 10) / 2;
          // 1 Top Full
          const img0 = await loadImage(session[0]);
          drawCover(ctx, img0, pMargin, pMargin, gridW, subH);
          // 2 Bottom Half Side by Side
          const img1 = await loadImage(session[1]);
          drawCover(ctx, img1, pMargin, pMargin + subH + 10, subW, subH);
          const img2 = await loadImage(session[2]);
          drawCover(ctx, img2, pMargin + subW + 10, pMargin + subH + 10, subW, subH);
        } else {
          // 4 Grid (2x2)
          const subW = (gridW - 10) / 2;
          const subH = (gridH - 10) / 2;
          const coords = [
            [pMargin, pMargin],
            [pMargin + subW + 10, pMargin],
            [pMargin, pMargin + subH + 10],
            [pMargin + subW + 10, pMargin + subH + 10],
          ];
          for (let i = 0; i < 4; i++) {
            const img = await loadImage(session[i]);
            drawCover(ctx, img, coords[i][0], coords[i][1], subW, subH);
          }
        }

        // --- Render Right Message Section ---
        const rightX = leftWidth + 24;
        const rightW = width - leftWidth - 48;

        // Stamp (Top Right)
        const stampSize = 64;
        const stampX = width - pMargin - stampSize;
        const stampY = pMargin;

        ctx.fillStyle = "#faf0ec";
        ctx.fillRect(stampX, stampY, stampSize, stampSize);
        ctx.strokeStyle = "#c97a7e";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(stampX, stampY, stampSize, stampSize);
        ctx.setLineDash([]);

        ctx.font = "24px 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💌", stampX + stampSize / 2, stampY + stampSize / 2);

        // Message Text
        ctx.fillStyle = "#4a3b32";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = "bold 18px 'Plus Jakarta Sans', sans-serif";
        
        // Wrap message text
        wrapText(ctx, bodyMsg, rightX, pMargin + 10, rightW - 70, 26);

        // Receiver / Sender Footer (Bottom Right)
        ctx.fillStyle = "#8c7a6e";
        ctx.font = "500 14px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText(toText, rightX, height - 80);
        ctx.fillText(fromText, rightX, height - 54);

        const resultBuffer = canvas.toBuffer("image/png");

        // Clear session after render
        postcardSessions.delete(senderJid);

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: resultBuffer,
            caption: `💌 *Kartu Pos Romantis*\n\n✨ Total Foto: ${session.length}\n⚡ _Via Kyros-MD_`,
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error("Error makepostcard:", err);
        await sock.sendMessage(
          msg.key.remoteJid,
          { text: "❌ Gagal membuat kartu pos." },
          { quoted: msg }
        );
      }
    },
  },
  {
    name: "clearpostcard",
    aliases: ["clearpc"],
    category: "Media",
    premiumOnly: true,
    description: "Mereset sesi kartu pos.",
    run: async (sock, msg, args, { senderJid }) => {
      postcardSessions.delete(senderJid);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "🗑️ Sesi kartu pos Anda telah dibersihkan." },
        { quoted: msg }
      );
    },
  },
  {
    name: "webpostcard",
    aliases: ["webpc", "linkpc", "postcardweb"],
    category: "Media",
    premiumOnly: true,
    description: "Mendapatkan link web Kartu Pos Cinta Romantis.",
    run: async (sock, msg) => {
      const webUrl = "https://photoboth.rakarizqi-cv.workers.dev/postcard";
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `💌 *Kartu Pos Cinta Web App*\n\nBuka link berikut di browser untuk membuat kartu pos romantis secara langsung:\n🔗 ${webUrl}\n\n✨ *Fitur Web App*:\n• Grid 1-4 foto otomatis\n• Pilihan font tulisan tangan\n• Kustomisasi pesan & nama penerima\n• Unduh gambar PNG HD`,
        },
        { quoted: msg }
      );
    },
  },
];

function drawCover(ctx, img, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
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

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}
