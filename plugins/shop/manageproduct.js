import {
  saveProduct,
  deleteProduct,
  listOrders,
  getOrder,
  updateOrderStatus,
} from "@/src/services/shop/shop.js";

function formatRupiah(num) {
  return "Rp" + Number(num).toLocaleString("id-ID");
}

export default {
  name: "manageproduct",
  aliases: ["addproduct", "delproduct", "listorders", "setorder"],
  description: "Kelola produk & pesanan toko (Khusus Admin / Owner)",
  usage: "<add/del/orders/set>",
  category: "Store",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, prefix, isOwner, isAdmin }) => {
    const p = prefix || ".";
    if (!isOwner && !isAdmin) {
      return reply("Perintah ini khusus untuk Owner atau Admin Toko.");
    }

    const invoked = String(msg.message?.extendedTextMessage?.text || msg.message?.conversation || "")
      .trim()
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/^[./!]/, "");

    let sub = (args[0] || "").toLowerCase();
    let subArgs = args.slice(1);

    if (invoked === "addproduct") {
      sub = "add";
      subArgs = args;
    } else if (invoked === "delproduct") {
      sub = "del";
      subArgs = args;
    } else if (invoked === "listorders") {
      sub = "orders";
      subArgs = args;
    } else if (invoked === "setorder") {
      sub = "set";
      subArgs = args;
    }

    if (!sub || sub === "help") {
      return reply(
        `*MANAJEMEN TOKO & PRODUK*\n\n` +
          `• *${p}addproduct <KODE> <HARGA> <STOK> <NAMA>*\n` +
          `  (Gunakan stok -1 untuk produk digital tak terbatas)\n` +
          `  Contoh: \`${p}addproduct CANVA 15000 -1 Canva Pro 1 Bulan\`\n\n` +
          `• *${p}delproduct <KODE>*\n` +
          `  Hapus produk dari toko\n\n` +
          `• *${p}listorders*\n` +
          `  Lihat daftar pesanan terbaru yang masuk\n\n` +
          `• *${p}setorder <ID_ORDER> <PAID/COMPLETED/CANCELLED>*\n` +
          `  Update status pembayaran pesanan`
      );
    }

    // 1. Tambah / Edit Produk
    if (sub === "add" || sub === "tambah") {
      const code = subArgs[0];
      const price = parseInt(subArgs[1], 10);
      const stock = parseInt(subArgs[2], 10);
      const name = subArgs.slice(3).join(" ").trim();

      if (!code || isNaN(price) || isNaN(stock) || !name) {
        return reply(
          `Format salah!\nGunakan: \`${p}addproduct <KODE> <HARGA> <STOK> <NAMA>\`\n` +
            `Contoh: \`${p}addproduct SPOTIFY 20000 -1 Spotify Premium 1 Bulan\``
        );
      }

      const prod = saveProduct({ code, price, stock, name });
      const stockStr = prod.stock === -1 ? "Unlimited" : `${prod.stock} unit`;
      return reply(
        `*PRODUK BERHASIL DISIMPAN:*\n\n` +
          `• *Kode:* ${prod.code}\n` +
          `• *Nama:* ${prod.name}\n` +
          `• *Harga:* ${formatRupiah(prod.price)}\n` +
          `• *Stok:* ${stockStr}`
      );
    }

    // 2. Hapus Produk
    if (sub === "del" || sub === "delete" || sub === "hapus") {
      const code = subArgs[0];
      if (!code) return reply(`Masukkan kode produk yang ingin dihapus. Contoh: \`${p}delproduct CANVA\``);
      const ok = deleteProduct(code);
      if (!ok) return reply(`Produk dengan kode *${code.toUpperCase()}* tidak ditemukan.`);
      return reply(`Produk *${code.toUpperCase()}* berhasil dihapus dari toko.`);
    }

    // 3. Lihat Pesanan
    if (sub === "orders" || sub === "pesanan") {
      const orders = listOrders(15);
      if (orders.length === 0) return reply("Belum ada transaksi / pesanan yang tercatat.");

      let out = `*DAFTAR PESANAN TERBARU (${orders.length}):*\n\n`;
      for (const ord of orders) {
        const buyer = String(ord.buyerJid || "").split("@")[0];
        out += `• *[${ord.id}]* ${ord.productName} (${ord.quantity}x)\n`;
        out += `  Buyer: @${buyer} | Total: ${formatRupiah(ord.totalPrice)}\n`;
        out += `  Status: *${ord.status}* | Tgl: ${ord.createdAt.slice(0, 10)}\n\n`;
      }
      return reply(out.trim());
    }

    // 4. Ubah Status Pesanan
    if (sub === "set" || sub === "status") {
      const orderId = subArgs[0];
      const status = (subArgs[1] || "").toUpperCase();
      if (!orderId || !["PAID", "COMPLETED", "CANCELLED", "PENDING"].includes(status)) {
        return reply(
          `Gunakan format: \`${p}setorder <ID_ORDER> <PAID|COMPLETED|CANCELLED|PENDING>\`\n` +
            `Contoh: \`${p}setorder ORD-M3K7 PAID\``
        );
      }
      const ord = getOrder(orderId);
      if (!ord) return reply(`Pesanan dengan ID *${orderId}* tidak ditemukan.`);

      updateOrderStatus(orderId, status);
      return reply(`Status pesanan *${orderId}* berhasil diubah menjadi: *${status}*.`);
    }

    return reply(`Perintah tidak dikenal. Ketik \`${p}manageproduct\` untuk panduan.`);
  },
};
