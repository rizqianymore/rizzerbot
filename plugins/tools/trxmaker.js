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
import { db } from "@/src/core/database.js";

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

      try {
        // Generate high-resolution receipt card
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
      } catch (err) {
        // Fallback to text if canvas fails
        await sock.sendMessage(
          remoteJid,
          {
            text: caption,
            mentions: trx.buyerJid ? [trx.buyerJid] : [],
          },
          { quoted: msg }
        );
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

      try {
        const cardBuffer = await generateReceiptCard(updated);
        await sock.sendMessage(
          remoteJid,
          {
            image: cardBuffer,
            caption,
            mentions: updated.buyerJid ? [updated.buyerJid] : [],
          },
          { quoted: msg }
        );
      } catch (_) {
        await reply(caption);
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

      let text = `📋 *DAFTAR TRANSAKSI TERBARU* (${list.length})\n─────────────────────────\n`;
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
];
