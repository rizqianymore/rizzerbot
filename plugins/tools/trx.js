import { createTransaction, generateReceiptCard, formatTrxText } from "@/src/services/finance/trx.js";
import { convertQRIS, generatePureQR, getActiveQrisString, parseQRIS } from "@/src/services/finance/qris.js";
import { db } from "@/src/core/database.js";
import { forwardTrxToChannel, parseTrxInput } from "@/src/services/finance/trx.js";

const recentBroadcastTrx = new Set();

export default {
  name: "trx",
  aliases: ["order", "invoice", "struk", "nota", "addtrx"],
  description: "Membuat struk transaksi / orderan otomatis (Text & Gambar Struk HD)",
  usage: "<barang> | <harga> | <buyer> | [metode]",
  adminOnly: true,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, quoted, getTargetJid, isGroup }) => {
    await sendTyping();

    const rawInput = args.join(" ").trim();
    if (!rawInput) {
      return reply(
        `*CARA MENGGUNAKAN TRX / ORDER MAKER:*\n\n` +
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
        `Format tidak lengkap! Mohon cantumkan nama barang dan nominal harga.\n\n` +
          `*Contoh:* .trx Diamond ML 86 | 20000 | @user | QRIS`
      );
    }

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
    } catch (_) {}

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
    } catch (_err) {
      await reply(caption);
    }

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
              `*QRIS DINAMIS PEMBAYARAN*\n` +
              `*Merchant:* ${parsed.merchantName || activeSettings.qrisMerchantName || "Rizzer Cloud"}\n` +
              `*Nominal Otomatis:* *${trx.formattedPrice}*\n` +
              `*Ref Transaksi:* \`${trx.id}\`\n\n` +
              `_Scan QR di atas melalui BCA, Mandiri, BRI, BNI, DANA, GoPay, OVO, ShopeePay. Nominal sudah terisi otomatis!_`,
            mentions: trx.buyerJid ? [trx.buyerJid] : [],
          },
          { quoted: msg }
        );
      } catch (qrisErr) {
        console.error("Gagal membuat QRIS dinamis:", qrisErr.message);
      }
    }

    const channelJid = activeSettings.channelJid || db.getSettings().channelJid || "";
    if (activeSettings.autoForwardTrxToChannel !== false && channelJid && channelJid.includes("@newsletter")) {
      const dedupeKey = `create_${trx.id}`;
      if (!recentBroadcastTrx.has(dedupeKey)) {
        recentBroadcastTrx.add(dedupeKey);
        if (recentBroadcastTrx.size > 200) {
          const [firstKey] = recentBroadcastTrx;
          recentBroadcastTrx.delete(firstKey);
        }

        const payload = cardBuffer ? { image: cardBuffer, caption } : { text: caption };

        forwardTrxToChannel(sock, channelJid, payload).catch((e) => {
          console.error("[TRX-Channel] Error forward create trx:", e.message);
        });
      }
    }
  },
};
