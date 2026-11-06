import { db } from "@/src/core/database.js";
import {
  getOrder,
  updateOrderStatus,
  listOrders,
  listProducts,
} from "@/src/services/shop/shop.js";
import {
  formatTestimonyMessage,
  forwardTestimonyToChannel,
} from "@/src/services/shop/testimony.js";
import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";

export default {
  name: "testi",
  aliases: ["testimoni", "posttesti", "trxpost"],
  description: "Kirim postingan testimoni transaksi ke saluran (Newsletter) resmi bot",
  usage: "[<id_order> | manual <produk> <harga> <nohp>] (bisa reply gambar struk)",
  category: "Store",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, prefix, isOwner, isAdmin }) => {
    const p = prefix || ".";
    if (!isOwner && !isAdmin) {
      return reply("Perintah posting testimoni hanya untuk Owner atau Admin Toko.");
    }

    const settings = db.main().getSettings();
    const channelJid = settings.channelJid;

    if (!channelJid || !channelJid.includes("@newsletter")) {
      return reply(
        `Saluran bot belum diatur!\n` +
          `Gunakan \`${p}setch <JID_SALURAN>\` terlebih dahulu untuk menghubungkan ke saluran.`
      );
    }

    const sub = (args[0] || "").toLowerCase();

    // 1. Cek apakah ada lampiran gambar struk/transaksi
    let imageBuffer = null;
    const target = findDownloadableTarget(msg);
    if (target) {
      try {
        imageBuffer = await getMediaBuffer(sock, target, { maxBytes: 15 * 1024 * 1024 });
      } catch (_) {}
    }

    // 2. Mode Otomatis dari ID Order (.testi ORD-XXXX)
    if (sub && sub.startsWith("ord-")) {
      const order = getOrder(sub);
      if (!order) return reply(`Pesanan dengan ID *${sub.toUpperCase()}* tidak ditemukan.`);

      updateOrderStatus(order.id, "COMPLETED");

      const ok = await forwardTestimonyToChannel(sock, order, { imageBuffer });
      if (ok) {
        return reply(
          `*TESTIMONI TERKIRIM!*\n` +
            `• ID: \`${order.id}\`\n` +
            `• Saluran: *${settings.channelName || channelJid}*\n` +
            `• Status Order: *COMPLETED*`
        );
      }
      return reply("Gagal mengirim testimoni ke saluran. Pastikan bot adalah Admin di saluran tersebut.");
    }

    // 3. Mode Manual (.testi manual <PRODUK> <HARGA> <NOHP>)
    if (sub === "manual") {
      const prodName = args[1];
      const price = parseInt(args[2], 10);
      const buyer = args[3] || "628xxxxxxxxxx";

      if (!prodName || isNaN(price)) {
        return reply(
          `Format testimoni manual:\n\`${p}testi manual <NAMA_PRODUK> <TOTAL_HARGA> [NOMOR_BUYER]\`\n` +
            `Contoh: \`${p}testi manual "Canva Pro" 15000 6281234567890\`\n` +
            `_Tip: Anda juga bisa sambil me-reply gambar bukti transfer!_`
        );
      }

      const dummyOrder = {
        id: `MAN-${Date.now().toString(36).toUpperCase()}`,
        buyerJid: buyer.includes("@") ? buyer : `${buyer}@s.whatsapp.net`,
        productName: prodName.replace(/["']/g, ""),
        productCode: "MANUAL",
        quantity: 1,
        totalPrice: price,
        createdAt: new Date().toISOString(),
      };

      const ok = await forwardTestimonyToChannel(sock, dummyOrder, { imageBuffer });
      if (ok) {
        return reply(`Testimoni manual berhasil diposting ke Saluran (*${settings.channelName || channelJid}*)!`);
      }
      return reply("Gagal mengirim testimoni ke saluran. Periksa perizinan bot di saluran.");
    }

    // Panduan jika argumen kosong
    return reply(
      `*POSTING TESTIMONI KE SALURAN*\n\n` +
        `• *Berdasarkan Order:* \`${p}testi <ID_ORDER>\`\n` +
        `  Contoh: \`${p}testi ORD-ABC12\` (Otomatis ubah status ke COMPLETED)\n\n` +
        `• *Manual:* \`${p}testi manual <PRODUK> <HARGA> <NOHP>\`\n` +
        `  Contoh: \`${p}testi manual "Netflix 1 Bulan" 35000 6281234567890\`\n\n` +
        `_Catatan: Balas (reply) gambar struk pembayaran saat mengetik perintah agar foto ikut diposting ke saluran._`
    );
  },
};
