import {
  createTransaction,
  getTransaction,
  updateTransaction,
  listTransactions,
  deleteTransaction,
  generateReceiptCard,
  formatTrxText,
  formatRupiah,
} from "@/src/services/trx.js";
import {
  convertQRIS,
  generatePureQR,
  generateQrisCard,
  getActiveQrisString,
  parseQRIS,
  validateQRIS,
} from "@/src/services/qris.js";
import { db } from "@/src/core/database.js";

import { getPrimarySock } from "@/src/core/connection.js";

const channelAdminCache = new Map();

const recentBroadcastTrx = new Set();

async function checkIsChannelAdmin(targetSock, channelJid) {
  if (!channelJid || !channelJid.includes("@newsletter")) return false;
  const now = Date.now();
  const cached = channelAdminCache.get(channelJid);
  if (cached && now - cached.timestamp < 5 * 60 * 1000) {
    return cached.isAdmin;
  }

  let isAdmin = true;
  try {
    if (typeof targetSock?.newsletterMetadata === "function") {
      const meta = await targetSock.newsletterMetadata("jid", channelJid);
      const role = meta?.viewer_metadata?.role;
      if (role) {
        isAdmin = role === "ADMIN" || role === "OWNER";
      }
    }
  } catch (_) {

    isAdmin = true;
  }

  channelAdminCache.set(channelJid, { isAdmin, timestamp: now });
  return isAdmin;
}

async function forwardTrxToChannel(sock, channelJid, payload) {
  if (!channelJid || !channelJid.includes("@newsletter")) return false;

  let sent = false;
  try {
    const isChannelAdmin = await checkIsChannelAdmin(sock, channelJid);
    if (isChannelAdmin) {
      await sock.sendMessage(channelJid, payload);
      sent = true;
    }
  } catch (err) {
    console.error("[TRX-Channel] Gagal kirim via socket aktif:", err.message);
  }

  if (!sent) {
    try {
      const primary = getPrimarySock();
      if (primary && primary !== sock) {
        await primary.sendMessage(channelJid, payload);
        sent = true;
      }
    } catch (err2) {
      console.error("[TRX-Channel] Fallback kirim via primary bot juga gagal:", err2.message);
    }
  }

  return sent;
}

function parseTrxInput(rawText, quoted, getTargetJid) {
  let item = "";
  let price = 0;
  let buyer = "";
  let payment = "QRIS";
  let status = "LUNAS";
  let note = "-";

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  const isKeyValue = lines.some((l) => /^(barang|pesanan|item|harga|price|nominal|buyer|pembeli|metode|payment|status|catatan|note):/i.test(l));

  if (isKeyValue) {
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().toLowerCase();
        const val = match[2].trim();
        if (["barang", "pesanan", "item", "produk"].includes(key)) item = val;
        else if (["harga", "price", "nominal", "total"].includes(key)) price = val;
        else if (["buyer", "pembeli", "customer", "nama"].includes(key)) buyer = val;
        else if (["metode", "payment", "via", "pembayaran"].includes(key)) payment = val;
        else if (["status"].includes(key)) status = val;
        else if (["catatan", "note", "ket", "keterangan"].includes(key)) note = val;
      }
    }
  } else if (rawText.includes("|")) {
    const parts = rawText.split("|").map((p) => p.trim());
    if (parts[0]) item = parts[0];
    if (parts[1]) price = parts[1];
    if (parts[2]) buyer = parts[2];
    if (parts[3]) payment = parts[3];
    if (parts[4]) status = parts[4];
    if (parts[5]) note = parts[5];
  } else {

    const words = rawText.split(/\s+/);
    if (words.length >= 2) {

      const priceIdx = words.findIndex((w) => /^\d+(\.\d+)?k?$/i.test(w) || /^rp\.?\d+/i.test(w));
      if (priceIdx !== -1) {
        item = words.slice(0, priceIdx).join(" ");
        let rawP = words[priceIdx].toLowerCase().replace(/^rp\.?/, "");
        if (rawP.endsWith("k")) rawP = String(parseFloat(rawP) * 1000);
        price = rawP;
        if (words[priceIdx + 1]) buyer = words.slice(priceIdx + 1).join(" ");
      } else {
        item = words.slice(0, -1).join(" ");
        price = words[words.length - 1];
      }
    }
  }

  if (!buyer && quoted) {
    buyer = "Customer (Replied)";
  }

  return { item, price, buyer, payment, status, note };
}

export default {
  "name": "settrx",
  "aliases": ["updatetrx","statustrx"],
  "description": "Update status transaksi (LUNAS, PENDING, PROSES, BATAL)",
  "usage": "<id_trx> <status>",
  "adminOnly": true,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      if (args.length < 2) {
        return reply(
          `❌ Format salah!\n*Gunakan:* \`.settrx <ID_TRX> <lunas|pending|proses|batal>\`\n*Contoh:* \`.settrx TRX-20260926-XXXX lunas\``
        );
      }

      const id = args[0];
      const newStatus = args.slice(1).join(" ");

      const updated = updateTransaction(id, { status: newStatus });
      if (!updated) {
        return reply(`❌ Transaksi dengan ID *"${id}"* tidak ditemukan.`);
      }

      const caption =
        `✅ *STATUS TRANSAKSI DIPERBARUI!*\n\n` + formatTrxText(updated);
      const remoteJid = msg.key.remoteJid;

      const activeSettings = db.getSettings();
      let cardBuffer = null;
      try {
        cardBuffer = await generateReceiptCard(updated);
      } catch (_) { }

      try {
        if (cardBuffer) {
          await sock.sendMessage(
            remoteJid,
            {
              image: cardBuffer,
              caption,
              mentions: updated.buyerJid ? [updated.buyerJid] : [],
            },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            remoteJid,
            {
              text: caption,
              mentions: updated.buyerJid ? [updated.buyerJid] : [],
            },
            { quoted: msg }
          );
        }
      } catch (_) {
        await reply(caption);
      }

      const channelJid = activeSettings.channelJid || db.getSettings().channelJid || "";
      if (activeSettings.autoForwardTrxToChannel !== false && channelJid && channelJid.includes("@newsletter")) {

        const dedupeKey = `update_${updated.id}_${updated.status}`;
        if (!recentBroadcastTrx.has(dedupeKey)) {
          recentBroadcastTrx.add(dedupeKey);
          if (recentBroadcastTrx.size > 200) {
            const [firstKey] = recentBroadcastTrx;
            recentBroadcastTrx.delete(firstKey);
          }

          const payload = cardBuffer
            ? { image: cardBuffer, caption }
            : { text: caption };

          forwardTrxToChannel(sock, channelJid, payload).catch((e) => {
            console.error("[TRX-Channel] Error forward update trx:", e.message);
          });
        }
      }
    },
};
