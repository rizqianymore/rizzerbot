import {
  listProducts,
  getProduct,
  getShopConfig,
  recordOrder,
} from "@/src/services/shop/shop.js";

function formatRupiah(num) {
  return "Rp" + Number(num).toLocaleString("id-ID");
}

export default {
  name: "shop",
  aliases: ["toko", "store", "katalog", "listproduk"],
  description: "Katalog produk & toko penjualan digital/fisik",
  usage: "[detail <code> | buy <code> [jumlah]]",
  category: "Store",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, prefix, senderJid }) => {
    const p = prefix || ".";
    const sub = (args[0] || "").toLowerCase();
    const config = getShopConfig();

    if (!sub || sub === "list") {
      const prods = listProducts();
      let text = `*${(config.shopName || "STORE").toUpperCase()}*\n`;
      text += `• Status: Buka\n`;
      text += `• Total Produk: ${prods.length}\n\n`;

      if (prods.length === 0) {
        text += `_Belum ada produk yang dijual saat ini._\n`;
        text += `_Owner dapat menambah produk dengan ketik \`${p}addproduct\`._`;
        return reply(text.trim());
      }

      text += `*DAFTAR PRODUK:*\n`;
      for (const item of prods) {
        const stockStr = item.stock === -1 ? "Tersedia" : `${item.stock} item`;
        text += `• *[${item.code}]* ${item.name}\n`;
        text += `  Harga: *${formatRupiah(item.price)}* | Stok: ${stockStr}\n`;
      }

      text += `\n*Panduan Pembelian:*\n`;
      text += `• Detail: \`${p}shop detail <kode>\`\n`;
      text += `• Order : \`${p}buy <kode> [jumlah]\`\n\n`;
      text += `_Ketik \`${p}payment\` untuk info metode pembayaran resmi._`;
      return reply(text.trim());
    }

    if (sub === "detail" || sub === "info") {
      const code = args[1];
      if (!code) return reply(`Masukkan kode produk! Contoh: \`${p}shop detail NETFLIX\``);
      const prod = getProduct(code);
      if (!prod) return reply(`Produk dengan kode *${code.toUpperCase()}* tidak ditemukan.`);

      const stockStr = prod.stock === -1 ? "Tersedia (Unlimited)" : `${prod.stock} unit`;
      let text = `*DETAIL PRODUK:*\n\n`;
      text += `• *Kode:* ${prod.code}\n`;
      text += `• *Nama:* ${prod.name}\n`;
      text += `• *Harga:* ${formatRupiah(prod.price)}\n`;
      text += `• *Stok:* ${stockStr}\n`;
      if (prod.desc) text += `• *Deskripsi:*\n${prod.desc}\n`;
      text += `\nKetik \`${p}buy ${prod.code}\` untuk melakukan pemesanan.`;
      return reply(text.trim());
    }

    if (sub === "buy" || sub === "beli" || sub === "order") {
      const code = args[1];
      const qty = parseInt(args[2] || "1", 10);
      if (!code) return reply(`Masukkan kode produk yang ingin dibeli!\nContoh: \`${p}buy NETFLIX 1\``);
      if (isNaN(qty) || qty <= 0) return reply("Jumlah pembelian harus berupa angka positif minimal 1.");

      const prod = getProduct(code);
      if (!prod) return reply(`Produk dengan kode *${code.toUpperCase()}* tidak ditemukan.`);

      const total = prod.price * qty;

      try {
        const order = recordOrder({
          buyerJid: senderJid,
          code,
          quantity: qty,
          totalPrice: total,
          notes: args.slice(3).join(" "),
        });

        let out = `*INVOICE PEMESANAN DIBUAT*\n\n`;
        out += `• *ID Pesanan:* \`${order.id}\`\n`;
        out += `• *Produk:* ${order.productName} (${order.productCode})\n`;
        out += `• *Jumlah:* ${order.quantity}\n`;
        out += `• *Total Tagihan:* *${formatRupiah(order.totalPrice)}*\n`;
        out += `• *Status:* PENDING\n\n`;
        out += `*INSTRUKSI PEMBAYARAN:*\n`;
        out += `${config.paymentInfo || "Silakan lakukan pembayaran via QRIS atau Transfer Rekening."}\n\n`;
        out += `Kirim bukti transfer ke Admin/Owner bot dengan menyertakan ID Pesanan: \`${order.id}\`.`;

        return reply(out.trim());
      } catch (err) {
        return reply(`Gagal membuat order: ${err?.message || err}`);
      }
    }

    return reply(`Perintah tidak dikenal. Ketik \`${p}shop\` untuk melihat katalog produk.`);
  },
};
