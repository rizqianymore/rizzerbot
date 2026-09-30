// plugins/tools/trx.js — mandiri: 1 file = 1 perintah (helper digabung langsung).
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

// Cache status admin channel per JID saluran (TTL 5 menit)
const channelAdminCache = new Map();
// Cache deduplikasi pengiriman broadcast ke saluran agar 1 transaksi tidak dikirim ganda
const recentBroadcastTrx = new Set();

async function checkIsChannelAdmin(targetSock, channelJid) {
  if (!channelJid || !channelJid.includes("@newsletter")) return false;
  const now = Date.now();
  const cached = channelAdminCache.get(channelJid);
  if (cached && now - cached.timestamp < 5 * 60 * 1000) {
    return cached.isAdmin;
  }

  let isAdmin = true; // Default optimis: izinkan coba kirim
  try {
    if (typeof targetSock?.newsletterMetadata === "function") {
      const meta = await targetSock.newsletterMetadata("jid", channelJid);
      const role = meta?.viewer_metadata?.role;
      if (role) {
        isAdmin = role === "ADMIN" || role === "OWNER";
      }
    }
  } catch (_) {
    // Jika newsletterMetadata error (misal rate limit), biarkan coba kirim langsung
    isAdmin = true;
  }

  channelAdminCache.set(channelJid, { isAdmin, timestamp: now });
  return isAdmin;
}

async function forwardTrxToChannel(sock, channelJid, payload) {
  if (!channelJid || !channelJid.includes("@newsletter")) return false;

  // Coba kirim via socket aktif terlebih dahulu
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

  // Jika gagal dan socket saat ini bukan primary sock (misal sub-bot), fallback coba via Bot Utama
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

  // Check if multiline Key: Value format
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
    // Space-separated fallback: item... price [buyer]
    const words = rawText.split(/\s+/);
    if (words.length >= 2) {
      // Find the word that is numeric or looks like price
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

  // Handle buyer fallback from quoted message or target
  if (!buyer && quoted) {
    buyer = "Customer (Replied)";
  }

  return { item, price, buyer, payment, status, note };
}

export default {
  "name": "trx",
  "aliases": ["order","invoice","struk","nota","addtrx"],
  "description": "Membuat struk transaksi / orderan otomatis (Text & Gambar Struk HD)",
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping, quoted, getTargetJid, isGroup }) => {
      await sendTyping();

      const rawInput = args.join(" ").trim();
      if (!rawInput) {
        return reply(
          `🛒 *CARA MENGGUNAKAN TRX / ORDER MAKER:*\n\n` +
          `*Format 1 (Garis Pemisah |):*\n` +
          `*.trx <barang> | <harga> | <buyer> | [metode] | [status] | [catatan]*\n\n` +
          `*Contoh:*\n` +
          `*.trx Spotify 1 Bulan | 25000 | @buyer | QRIS | LUNAS | Garansi 30 Hari*\n\n` +
          `*Format 2 (Baris Titik Dua):*\n` +
          `*.trx*\n` +
          `Barang: Netflix Premium 1P\n` +
          `Harga: 35000\n` +
          `Buyer: Budi\n` +
          `Metode: DANA\n` +
          `Status: LUNAS\n` +
          `Catatan: 1 Profile 1 Device`
        );
      }

      const parsed = parseTrxInput(rawInput, quoted, getTargetJid);

      if (!parsed.item || !parsed.price) {
        return reply(
          `❌ Format tidak lengkap! Mohon cantumkan nama barang dan nominal harga.\n\n` +
          `*Contoh:* .trx Diamond ML 86 | 20000 | @user | QRIS`
        );
      }

      // Check mentioned user for buyer tag
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const remoteJid = msg.key.remoteJid;
      const activeSettings = db.getSettings();
      const storeName = activeSettings.botName || "RIZZER STORE";

      const trx = createTransaction({
        item: parsed.item,
        price: parsed.price,
        buyer: parsed.buyer || msg.pushName || "Customer",
        buyerJid: mentionedJid[0] || (quoted ? getTargetJid([]) : null),
        payment: parsed.payment || "QRIS",
        status: parsed.status || "LUNAS",
        note: parsed.note || "-",
        sellerJid: msg.key.participant || msg.key.remoteJid,
        groupJid: isGroup ? remoteJid : null,
        storeName,
      });

      const caption = formatTrxText(trx);

      let cardBuffer = null;
      try {
        cardBuffer = await generateReceiptCard(trx);
      } catch (_) { }

      try {
        if (cardBuffer) {
          await sock.sendMessage(
            remoteJid,
            {
              image: cardBuffer,
              caption,
              mentions: trx.buyerJid ? [trx.buyerJid] : [],
            },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            remoteJid,
            {
              text: caption,
              mentions: trx.buyerJid ? [trx.buyerJid] : [],
            },
            { quoted: msg }
          );
        }
      } catch (err) {
        await reply(caption);
      }

      // Jika pembayaran QRIS dan status transaksi PENDING, kirimkan QRIS Dinamis otomatis!
      if (trx.payment.includes("QRIS") && (trx.status === "PENDING" || trx.status === "PROSES")) {
        try {
          const qrisStatic = getActiveQrisString();
          const dynamicPayload = convertQRIS(qrisStatic, { amount: trx.price });
          const parsed = parseQRIS(dynamicPayload);
          const qrBuffer = await generatePureQR(dynamicPayload);

          await sock.sendMessage(
            remoteJid,
            {
              image: qrBuffer,
              caption:
                `📱 *QRIS DINAMIS PEMBAYARAN*\n` +
                `🏪 *Merchant:* ${parsed.merchantName || activeSettings.qrisMerchantName || "Rizzer Cloud"}\n` +
                `💰 *Nominal Otomatis:* *${trx.formattedPrice}*\n` +
                `🆔 *Ref Transaksi:* \`${trx.id}\`\n\n` +
                `_Scan QR di atas melalui BCA, Mandiri, BRI, BNI, DANA, GoPay, OVO, ShopeePay. Nominal sudah terisi otomatis!_`,
              mentions: trx.buyerJid ? [trx.buyerJid] : [],
            },
            { quoted: msg }
          );
        } catch (qrisErr) {
          console.error("Gagal membuat QRIS dinamis:", qrisErr.message);
        }
      }

      // Auto-forward ke Saluran WhatsApp jika dikonfigurasi
      const channelJid = activeSettings.channelJid || db.getSettings().channelJid || "";
      if (activeSettings.autoForwardTrxToChannel !== false && channelJid && channelJid.includes("@newsletter")) {
        // Cek duplikasi: jika ID transaksi ini sudah pernah dibroadcast, jangan kirim ulang
        const dedupeKey = `create_${trx.id}`;
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
            console.error("[TRX-Channel] Error forward create trx:", e.message);
          });
        }
      }
    },
};
