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
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("08")) return `628${digits.slice(2)}`;
  return digits;
}

function listStatusFiles(filterQuery = "") {
  if (!fs.existsSync(STATUSES_DIR)) return [];
  let files = [];
  try {
    files = fs.readdirSync(STATUSES_DIR);
  } catch (_) {
    return [];
  }

  const cleanQuery = String(filterQuery || "").replace(/\D/g, "");
  const querySuffix = cleanQuery.startsWith("0")
    ? cleanQuery.slice(1)
    : cleanQuery.startsWith("62")
      ? cleanQuery.slice(2)
      : cleanQuery;

  const matched = files.filter((name) => {
    if (!name.startsWith("status_")) return false;
    if (!/\.(jpe?g|png|webp|mp4|mov|m4a|mp3|ogg)$/i.test(name)) return false;
    if (!querySuffix) return true; // Tampilkan semua jika tanpa filter
    return name.includes(querySuffix);
  });

  // Urutkan dari status yang paling baru
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
    const mime = mimetypeFor(ext);

    if (type === "video") {
      await sock.sendMessage(
        msg.key.remoteJid,
        { video: buf, mimetype: "video/mp4", caption: "✅ Status video berhasil diunduh." },
        { quoted: msg }
      );
    } else if (type === "image") {
      await sock.sendMessage(
        msg.key.remoteJid,
        { image: buf, mimetype: "image/jpeg", caption: "✅ Status foto berhasil diunduh." },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { document: buf, mimetype: mime, fileName: `Status_${Date.now()}${ext}`, caption: "✅ Status berhasil diunduh." },
        { quoted: msg }
      );
    }
  } catch (err) {
    await reply(`❌ Gagal mendownload status: ${err?.message || err}`);
  }
}

export default {
  name: "sw",
  aliases: ["downloadsw", "status", "statussaver", "swdl"],
  description: "Download status WhatsApp (SW) dari kontak tersimpan atau reply status",
  usage: "[nomor/kontak] [urutan] (atau reply status)",
  category: "Downloader & Media",
  run: async (sock, msg, args, { reply, sendTyping, prefix, getTargetJid }) => {
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

    // Mode 1: Reply status WhatsApp langsung
    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = quotedInfo?.quotedMessage;
    const quotedMedia = getMediaNode(quotedMsg);

    if (quotedMedia) {
      await sendTyping();
      await downloadRepliedStatus(sock, msg, quotedInfo, quotedMedia, reply);
      return;
    }

    // Mode 2: Cari status tersimpan dari kontak / nomor HP / mention
    const targetJid = getTargetJid?.(args);
    const targetNumber = targetJid ? normalizeNumber(targetJid) : normalizeNumber(args[0]);

    if (!fs.existsSync(STATUSES_DIR)) {
      fs.mkdirSync(STATUSES_DIR, { recursive: true });
    }

    const files = listStatusFiles(targetNumber);

    if (files.length === 0) {
      if (targetNumber) {
        return reply(
          `Belum ada status yang terekam dari nomor *+${targetNumber}*.\n` +
            `_Pastikan bot sudah menyimpan kontak tersebut dan statusnya pernah dibuka/muncul di WhatsApp bot._`
        );
      }
      return reply(
        `*DOWNLOAD STATUS (SW)*\n\n` +
          `Belum ada status yang terekam dalam 24 jam terakhir.\n\n` +
          `*Cara Penggunaan:*\n` +
          `• Reply status orang lain lalu ketik \`${prefix || "."}sw\`\n` +
          `• Ketik \`${prefix || "."}sw <nomor/tag kontak> [urutan]\` untuk mengambil status tersimpan.`
      );
    }

    let idx = 1;
    // Parameter urutan angka jika disediakan di args
    const candidateIdx = parseInt(String(args[1] || (!targetNumber ? args[0] : "")).replace(/\D/g, ""), 10);
    if (Number.isFinite(candidateIdx) && candidateIdx >= 1) {
      if (candidateIdx > files.length) {
        return reply(`Urutan tidak valid. Hanya tersedia *${files.length}* status.`);
      }
      idx = candidateIdx;
    }

    const selectedFile = files[idx - 1];
    const filePath = path.join(STATUSES_DIR, selectedFile);
    let buffer;
    try {
      buffer = fs.readFileSync(filePath);
    } catch (err) {
      return reply(`Gagal membaca file status: ${err?.message || err}`);
    }

    const ext = path.extname(selectedFile).toLowerCase();
    const isVideo = ext === ".mp4" || ext === ".mov";
    const isImage = ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".webp";
    const senderMatch = selectedFile.match(/status_(\d+)_/);
    const senderNumber = senderMatch ? senderMatch[1] : "kontak";

    await sendTyping();
    const caption = `✅ *STATUS DOWNLOADER*\n\nDari: *+${senderNumber}*\nStatus: #${idx} dari ${files.length} tersimpan.`;

    if (isVideo) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { video: buffer, caption, mimetype: "video/mp4" },
        { quoted: msg }
      );
    } else if (isImage) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { image: buffer, caption, mimetype: ext === ".webp" ? "image/webp" : "image/jpeg" },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(
        msg.key.remoteJid,
        { document: buffer, caption, mimetype: mimetypeFor(ext), fileName: selectedFile },
        { quoted: msg }
      );
    }
  },
};
