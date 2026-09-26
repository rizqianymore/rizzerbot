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
  generateQrisCard,
  getActiveQrisString,
  parseQRIS,
  validateQRIS,
} from "@/src/services/qris.js";
import { db } from "@/src/core/database.js";

// Cache status admin channel per JID saluran (TTL 5 menit)
const channelAdminCache = new Map();
// Cache deduplikasi pengiriman broadcast ke saluran agar 1 transaksi tidak dikirim ganda
const recentBroadcastTrx = new Set();

async function checkIsChannelAdmin(sock, channelJid) {
  if (!channelJid || !channelJid.includes("@newsletter")) return false;
  const now = Date.now();
  const cached = channelAdminCache.get(channelJid);
  if (cached && now - cached.timestamp < 5 * 60 * 1000) {
    return cached.isAdmin;
  }

  let isAdmin = false;
  try {
    if (typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("jid", channelJid);
      const role = meta?.viewer_metadata?.role;
      isAdmin = role === "ADMIN" || role === "OWNER";
    } else {
      // Fallback: anggap true jika method tidak tersedia
      isAdmin = true;
    }
  } catch (_) {
    isAdmin = false;
  }

  channelAdminCache.set(channelJid, { isAdmin, timestamp: now });
  return isAdmin;
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

export default [
  {
    name: "trx",
    aliases: ["order", "invoice", "struk", "nota", "addtrx"],
    description: "Membuat struk transaksi / orderan otomatis (Text & Gambar Struk HD)",
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping, quoted, getTargetJid, isGroup }) => {
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
          const qrisCard = await generateQrisCard({
            qrisPayload: dynamicPayload,
            amount: trx.price,
            merchantName: parsed.merchantName || activeSettings.qrisMerchantName || "Rizzer Cloud",
            merchantCity: parsed.merchantCity || activeSettings.qrisCity || "JAKARTA BARAT",
          });

          await sock.sendMessage(
            remoteJid,
            {
              image: qrisCard,
              caption:
                `📱 *QRIS DINAMIS PEMBAYARAN*\n` +
                `🏪 *Merchant:* ${parsed.merchantName || "Rizzer Cloud"}\n` +
                `💰 *Nominal Otomatis:* *${trx.formattedPrice}*\n` +
                `🆔 *Ref Transaksi:* \`${trx.id}\`\n\n` +
                `_Scan QRIS di atas melalui BCA, Mandiri, BRI, DANA, GoPay, OVO, ShopeePay. Nominal sudah terisi otomatis!_`,
              mentions: trx.buyerJid ? [trx.buyerJid] : [],
            },
            { quoted: msg }
          );
        } catch (qrisErr) {
          console.error("Gagal membuat QRIS dinamis:", qrisErr.message);
        }
      }

      // Auto-forward ke Saluran WhatsApp jika dikonfigurasi & bot adalah admin di saluran
      const channelJid = activeSettings.channelJid || "";
      if (activeSettings.autoForwardTrxToChannel !== false && channelJid && channelJid.includes("@newsletter")) {
        // Cek duplikasi: jika ID transaksi ini sudah pernah dibroadcast (oleh bot utama / instance sub-bot yang sama), jangan kirim ulang
        const dedupeKey = `create_${trx.id}`;
        if (!recentBroadcastTrx.has(dedupeKey)) {
          const isChannelAdmin = await checkIsChannelAdmin(sock, channelJid);
          if (isChannelAdmin) {
            recentBroadcastTrx.add(dedupeKey);
            // Simpan riwayat maksimal 200 id agar memori tetap bersih
            if (recentBroadcastTrx.size > 200) {
              const [firstKey] = recentBroadcastTrx;
              recentBroadcastTrx.delete(firstKey);
            }

            try {
              if (cardBuffer) {
                await sock.sendMessage(channelJid, {
                  image: cardBuffer,
                  caption,
                });
              } else {
                await sock.sendMessage(channelJid, {
                  text: caption,
                });
              }
            } catch (channelErr) {
              console.error("Gagal mengirim transaksi ke saluran:", channelErr.message);
            }
          }
        }
      }
    },
  },
  {
    name: "cektrx",
    aliases: ["cekorder", "detailtrx", "invoicetrx"],
    description: "Cek detail struk transaksi berdasarkan ID Transaksi",
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const id = args[0];
      if (!id) {
        return reply("❌ Masukkan ID Transaksi yang ingin dicek!\n*Contoh:* `.cektrx TRX-20260926-XXXX`");
      }

      const trx = getTransaction(id);
      if (!trx) {
        return reply(`❌ Transaksi dengan ID *"${id}"* tidak ditemukan.`);
      }

      const caption = formatTrxText(trx);
      const remoteJid = msg.key.remoteJid;

      try {
        const cardBuffer = await generateReceiptCard(trx);
        await sock.sendMessage(
          remoteJid,
          {
            image: cardBuffer,
            caption,
            mentions: trx.buyerJid ? [trx.buyerJid] : [],
          },
          { quoted: msg }
        );
      } catch (_) {
        await reply(caption);
      }
    },
  },
  {
    name: "settrx",
    aliases: ["updatetrx", "statustrx"],
    description: "Update status transaksi (LUNAS, PENDING, PROSES, BATAL)",
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
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

      // Auto-forward update transaksi ke Saluran jika dikonfigurasi & bot adalah admin
      const channelJid = activeSettings.channelJid || "";
      if (activeSettings.autoForwardTrxToChannel !== false && channelJid && channelJid.includes("@newsletter")) {
        // Cek duplikasi: jika update status transaksi ini sudah pernah dibroadcast, jangan kirim ulang
        const dedupeKey = `update_${updated.id}_${updated.status}`;
        if (!recentBroadcastTrx.has(dedupeKey)) {
          const isChannelAdmin = await checkIsChannelAdmin(sock, channelJid);
          if (isChannelAdmin) {
            recentBroadcastTrx.add(dedupeKey);
            if (recentBroadcastTrx.size > 200) {
              const [firstKey] = recentBroadcastTrx;
              recentBroadcastTrx.delete(firstKey);
            }

            try {
              if (cardBuffer) {
                await sock.sendMessage(channelJid, {
                  image: cardBuffer,
                  caption,
                });
              } else {
                await sock.sendMessage(channelJid, {
                  text: caption,
                });
              }
            } catch (channelErr) {
              console.error("Gagal mengirim update transaksi ke saluran:", channelErr.message);
            }
          }
        }
      }
    },
  },
  {
    name: "listtrx",
    aliases: ["riwayattrx", "orderlist", "daftartrx"],
    description: "Melihat daftar transaksi orderan terbaru",
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping, isGroup }) => {
      await sendTyping();
      const limit = Number(args[0]) || 10;
      const remoteJid = msg.key.remoteJid;
      const list = listTransactions({ limit, groupJid: isGroup ? remoteJid : null });

      if (list.length === 0) {
        return reply("📋 Belum ada riwayat transaksi yang tersimpan.");
      }

      let text = `📋 *DAFTAR TRANSAKSI TERBARU* (${list.length})\n`;
      for (const [i, t] of list.entries()) {
        const statusIcon =
          t.status === "LUNAS" ? "✅" : t.status === "PROSES" ? "🔄" : t.status === "BATAL" ? "❌" : "⏳";
        text +=
          `*${i + 1}.* \`${t.id}\`\n` +
          `   🛒 *${t.item}* (${t.formattedPrice})\n` +
          `   👤 ${t.buyer} | ${statusIcon} *${t.status}*\n` +
          `   📅 ${t.time}\n\n`;
      }
      text += `_Ketik .cektrx <ID> untuk melihat struk lengkap._`;

      await reply(text);
    },
  },
  {
    name: "deltrx",
    aliases: ["hapustrx", "canceltrx"],
    description: "Hapus catatan transaksi dari database",
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const id = args[0];
      if (!id) {
        return reply("❌ Masukkan ID Transaksi yang ingin dihapus!\n*Contoh:* `.deltrx TRX-20260926-XXXX`");
      }

      const success = deleteTransaction(id);
      if (!success) {
        return reply(`❌ Transaksi dengan ID *"${id}"* tidak ditemukan.`);
      }

      await reply(`🗑️ Transaksi *"${id}"* berhasil dihapus dari sistem.`);
    },
  },
  {
    name: "qris",
    aliases: ["qrisdinamis", "payqris", "bayarqris"],
    description: "Buat kode QRIS Dinamis dengan nominal otomatis atau QRIS Statis",
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();
      const rawInput = args.join(" ").trim();
      const staticQris = getActiveQrisString();
      const activeSettings = db.getSettings();

      if (!rawInput) {
        // Tampilkan QRIS Statis Toko
        try {
          const parsed = parseQRIS(staticQris);
          const card = await generateQrisCard({
            qrisPayload: staticQris,
            amount: 0,
            merchantName: parsed.merchantName || activeSettings.qrisMerchantName || "Rizzer Cloud",
            merchantCity: parsed.merchantCity || activeSettings.qrisCity || "JAKARTA BARAT",
          });

          return await sock.sendMessage(
            msg.key.remoteJid,
            {
              image: card,
              caption:
                `🏪 *QRIS RESMI TOKO*\n` +
                `🏢 *Merchant:* ${parsed.merchantName || "Rizzer Cloud"}\n` +
                `📍 *Kota:* ${parsed.merchantCity || "JAKARTA BARAT"}\n` +
                `💳 *Tipe:* QRIS Statis (Nominal Bebas)\n\n` +
                `💡 _Ingin nominal otomatis? Ketik: \`${prefix}qris <nominal>\` (Contoh: \`${prefix}qris 25000\`)_`,
            },
            { quoted: msg }
          );
        } catch (err) {
          return reply(`❌ Gagal membuat kartu QRIS: ${err.message}`);
        }
      }

      // Bersihkan nominal harga
      let cleanInput = rawInput.toLowerCase().replace(/^rp\.?/, "").trim();
      if (cleanInput.endsWith("k")) cleanInput = String(parseFloat(cleanInput) * 1000);
      const amount = Number(cleanInput.replace(/[^0-9.]/g, ""));

      if (!amount || isNaN(amount) || amount <= 0) {
        return reply(`❌ Masukkan nominal yang valid!\n*Contoh:* \`${prefix}qris 15000\` atau \`${prefix}qris 25k\``);
      }

      try {
        const dynamicPayload = convertQRIS(staticQris, { amount });
        const parsed = parseQRIS(dynamicPayload);
        const card = await generateQrisCard({
          qrisPayload: dynamicPayload,
          amount,
          merchantName: parsed.merchantName || activeSettings.qrisMerchantName || "Rizzer Cloud",
          merchantCity: parsed.merchantCity || activeSettings.qrisCity || "JAKARTA BARAT",
        });

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: card,
            caption:
              `⚡ *QRIS DINAMIS SIAP BAYAR*\n` +
              `🏢 *Merchant:* ${parsed.merchantName || "Rizzer Cloud"}\n` +
              `📍 *Kota:* ${parsed.merchantCity || "JAKARTA BARAT"}\n` +
              `💰 *Total Nominal:* *${formatRupiah(amount)}*\n` +
              `⏱️ *Kedaluwarsa:* 15 Menit\n\n` +
              `_Scan langsung dengan DANA, BCA, GoPay, OVO, ShopeePay, atau m-Banking Anda. Nominal otomatis terinput pas!_`,
          },
          { quoted: msg }
        );
      } catch (err) {
        reply(`❌ Gagal memproses QRIS Dinamis: ${err.message}`);
      }
    },
  },
  {
    name: "setqris",
    aliases: ["updateqris"],
    description: "Atur string QRIS statis utama bot (Khusus Owner)",
    ownerOnly: true,
    category: "Owner",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const newString = args.join(" ").trim();
      if (!newString) {
        const cur = getActiveQrisString();
        const parsed = parseQRIS(cur);
        return reply(
          `📱 *PENGATURAN QRIS TOKO*\n\n` +
          `• *Merchant:* ${parsed.merchantName || "-"}\n` +
          `• *Kota:* ${parsed.merchantCity || "-"}\n` +
          `• *String Aktif:* \`${cur}\`\n\n` +
          `*Cara Mengganti:*\n` +
          `• \`.setqris <string_qris_baru>\``
        );
      }

      const validation = validateQRIS(newString);
      if (!validation.valid) {
        return reply(
          `❌ Format string QRIS tidak valid!\n` +
          `Alasan:\n- ` +
          validation.errors.join("\n- ")
        );
      }

      const parsed = parseQRIS(newString);
      db.updateSettings({
        qrisString: newString,
        qrisMerchantName: parsed.merchantName || "Rizzer Cloud",
        qrisCity: parsed.merchantCity || "JAKARTA BARAT",
      });

      reply(
        `✅ *QRIS Berhasil Diperbarui!*\n\n` +
        `🏢 *Merchant:* ${parsed.merchantName}\n` +
        `📍 *Kota:* ${parsed.merchantCity}\n` +
        `🔐 *CRC16:* ${parsed.crc} (Valid)\n` +
        `⚡ Semua pembayaran otomatis akan menggunakan QRIS ini.`
      );
    },
  },
];
