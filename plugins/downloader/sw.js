import fs from "fs";
import path from "path";
import { downloadContentFromMessage } from "ourin-baileys";

const STATUSES_DIR = path.join(process.cwd(), "statuses");

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

function normalizeNumber(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function listStatusFiles(digits) {
  if (!fs.existsSync(STATUSES_DIR)) return [];
  let files = [];
  try {
    files = fs.readdirSync(STATUSES_DIR);
  } catch (_) {
    return [];
  }
  const prefix = `status_${digits}_`;
  const matched = files.filter((name) => {
    if (!name.startsWith(prefix)) return false;
    return /\.(jpe?g|png|webp|mp4|mov|m4a|mp3|ogg)$/i.test(name);
  });

  // terbaru dulu (berdasarkan timestamp di nama file, lalu mtime)
  matched.sort((a, b) => {
    const ta = Number((a.match(/_(\d+)\./) || [])[1] || 0);
    const tb = Number((b.match(/_(\d+)\./) || [])[1] || 0);
    if (tb !== ta) return tb - ta;
    try {
      return fs.statSync(path.join(STATUSES_DIR, b)).mtimeMs - fs.statSync(path.join(STATUSES_DIR, a)).mtimeMs;
    } catch (_) {
      return 0;
    }
  });
  return matched;
}

function mimetypeFor(ext) {
  const e = String(ext || "").toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  if (e === ".mp4" || e === ".mov") return "video/mp4";
  if (e === ".m4a") return "audio/mp4";
  if (e === ".mp3") return "audio/mpeg";
  if (e === ".ogg") return "audio/ogg";
  return "application/octet-stream";
}

async function downloadRepliedStatus(sock, msg, quotedInfo, quotedMedia, reply) {
  try {
    let buf = null;
    const inner =
      quotedMedia.imageMessage ||
      quotedMedia.videoMessage ||
      quotedMedia.audioMessage ||
      quotedMedia.documentMessage ||
      quotedMedia.stickerMessage;
    const type = quotedMedia.imageMessage
      ? "image"
      : quotedMedia.videoMessage
        ? "video"
        : quotedMedia.audioMessage
          ? "audio"
          : quotedMedia.stickerMessage
            ? "sticker"
            : quotedMedia.documentMessage
              ? "document"
              : null;
    if (!type || !inner) {
      await reply("❌ Media status tidak dikenali.");
      return;
    }
    const stream = await downloadContentFromMessage(inner, type);
    buf = await streamToBuffer(stream);

    const ext = type === "image" ? ".jpg" : type === "video" ? ".mp4" : type === "audio" ? ".m4a" : ".bin";
    const fileName = `Status_${Date.now()}${ext}`;
    await sock.sendMessage(
      msg.key.remoteJid,
      {
        document: buf,
        mimetype: mimetypeFor(ext),
        fileName,
        caption: "✅ Status berhasil didownload.",
      },
      { quoted: msg }
    );
  } catch (err) {
    await reply(`❌ Gagal mendownload status: ${err?.message || err}`);
  }
}

export default {
  name: "sw",
  aliases: ["downloadsw", "download", "save"],
  description: "Download status WhatsApp (SW). By nomor bot: .sw <nomor bot> [urutan]",
  usage: "<nomor bot> [urutan] (atau reply status)",
  category: "Downloader",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const { extractMessageContent } = await import("ourin-baileys");

    const getMediaNode = (m) => {
      if (!m) return null;
      const content = (typeof extractMessageContent === "function" ? extractMessageContent(m) : m) || null;
      if (!content) return null;
      const keys = Object.keys(content);
      const hasMedia =
        keys.includes("imageMessage") ||
        keys.includes("videoMessage") ||
        keys.includes("audioMessage") ||
        keys.includes("stickerMessage") ||
        keys.includes("documentMessage");
      if (hasMedia) return content;
      if (keys.includes("viewOnceMessage")) return getMediaNode(content.viewOnceMessage?.message);
      if (keys.includes("viewOnceMessageV2")) return getMediaNode(content.viewOnceMessageV2?.message);
      if (keys.includes("viewOnceMessageV2Extension")) return getMediaNode(content.viewOnceMessageV2Extension?.message);
      if (keys.includes("ephemeralMessage")) return getMediaNode(content.ephemeralMessage?.message);
      return null;
    };

    const firstDigits = normalizeNumber(args[0]);

    // Mode 1: download by nomor bot
    if (firstDigits.length >= 8 && args[0]) {
      // jika user memberi nomor tapi bukan bot, tetap cek
      await sendTyping();
      if (!fs.existsSync(STATUSES_DIR)) {
        fs.mkdirSync(STATUSES_DIR, { recursive: true });
      }

      const files = listStatusFiles(firstDigits);
      if (files.length === 0) {
        return reply(`Belum ada status tersimpan untuk bot *+${firstDigits}*.`);
      }

      let idx = 1;
      if (args[1]) {
        const n = parseInt(String(args[1]).replace(/[^0-9]/g, ""), 10);
        if (!Number.isFinite(n) || n < 1 || n > files.length) {
          return reply(
            `Urutan tidak valid. Tersedia ${files.length} status untuk *+${firstDigits}*.\n` +
              `Contoh: *.sw ${firstDigits} 1*`
          );
        }
        idx = n;
      }

      const fileName = files[idx - 1];
      const filePath = path.join(STATUSES_DIR, fileName);
      let buffer;
      try {
        buffer = fs.readFileSync(filePath);
      } catch (err) {
        return reply(`Gagal membaca file status: ${err?.message || err}`);
      }
      const ext = path.extname(fileName);
      const mime = mimetypeFor(ext);
      const caption = `✅ Status bot *+${firstDigits}* (#${idx}/${files.length}) berhasil didownload.`;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          document: buffer,
          mimetype: mime,
          fileName,
          caption,
        },
        { quoted: msg }
      );
      return;
    }

    // Mode 2: reply status (legacy)
    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = quotedInfo?.quotedMessage;
    const quotedMedia = getMediaNode(quotedMsg);

    if (quotedMedia) {
      await sendTyping();
      await downloadRepliedStatus(sock, msg, quotedInfo, quotedMedia, reply);
      return;
    }

    return reply(
      `*DOWNLOAD STATUS (SW)*\n\n` +
        `• \`${prefix || "."}sw <nomor bot> [urutan]\` — download status bot yang tersimpan\n` +
        `• Reply status lalu \`${prefix || "."}sw\` — download status yang dibalas\n\n` +
        `_Contoh: \`${prefix || "."}sw 6281234567890 1\`_`
    );
  },
};
