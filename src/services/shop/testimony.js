import { db } from "@/src/core/database.js";
import { getProduct } from "./shop.js";

export function formatRupiah(num) {
  return "Rp" + Number(num).toLocaleString("id-ID");
}

function maskPhone(jid) {
  const digits = String(jid || "").split("@")[0].replace(/\D/g, "");
  if (digits.length <= 6) return digits;
  return digits.slice(0, 4) + "xxxx" + digits.slice(-3);
}

/**
 * Format postingan testimoni transaksi untuk saluran (Newsletter)
 */
export function formatTestimonyMessage({
  orderId,
  buyerJid,
  productName,
  productCode,
  quantity,
  totalPrice,
  date,
  shopName,
}) {
  const dateStr = date
    ? new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    : new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  const buyerMasked = maskPhone(buyerJid);
  const totalStr = "Rp" + Number(totalPrice).toLocaleString("id-ID");

  let out = `╭━━━━━━━『 *TESTIMONI TRANSAKSI* 』━━━━━━━\n`;
  out += `│ • Toko: *${(shopName || "STORE").toUpperCase()}*\n`;
  out += `│ • Status: *SUKSES / COMPLETED*\n`;
  out += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  out += `*RINCIAN TRANSAKSI:*\n`;
  out += `• ID Order  : \`${orderId}\`\n`;
  out += `• Produk    : ${productName} (${productCode})\n`;
  out += `• Jumlah    : ${quantity} pcs\n`;
  out += `• Total     : *${totalStr}*\n`;
  out += `• Pembeli   : +${buyerMasked}\n`;
  out += `• Waktu     : ${dateStr} WIB\n\n`;

  out += `*Terima kasih telah mempercayakan transaksi Anda kepada kami!*\n`;
  out += `_Ingin order? Hubungi bot atau ketik \`.shop\`._`;

  return out.trim();
}

/**
 * Kirim bukti testimoni / transaksi ke saluran (newsletter) resmi
 */
export async function forwardTestimonyToChannel(sock, order, options = {}) {
  try {
    const settings = db.main().getSettings();
    if (settings.autoForwardTrxToChannel === false) return false;

    const channelJid = settings.channelJid;
    if (!channelJid || !channelJid.includes("@newsletter")) return false;

    const text = formatTestimonyMessage({
      orderId: order.id,
      buyerJid: order.buyerJid,
      productName: order.productName,
      productCode: order.productCode,
      quantity: order.quantity,
      totalPrice: order.totalPrice,
      date: order.createdAt,
      shopName: settings.channelName || "STORE",
    });

    if (options.imageBuffer) {
      await sock.sendMessage(channelJid, {
        image: options.imageBuffer,
        caption: text,
      });
    } else {
      await sock.sendMessage(channelJid, {
        text,
      });
    }
    return true;
  } catch (err) {
    console.error("[TestimonyChannel] Gagal kirim ke saluran:", err.message);
    return false;
  }
}
