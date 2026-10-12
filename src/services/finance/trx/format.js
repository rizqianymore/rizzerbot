import { getStatusBadge } from "./query.js";

export function formatTrxText(trx) {
  const badge = getStatusBadge(trx.status);
  return (
    `🧾 *STRUK TRANSAKSI RESMI*\n` +
    `🏪 *${(trx.storeName || "RIZZER STORE").toUpperCase()}*\n` +
    `🆔 *ID Trx:* \`${trx.id}\`\n` +
    `📅 *Tanggal:* ${trx.time}\n` +
    `👤 *Pembeli:* ${trx.buyer}\n` +
    `🛒 *Barang/Layanan:* *${trx.item}*\n` +
    `💳 *Metode:* ${trx.payment}\n` +
    `💰 *Total:* *${trx.formattedPrice}*\n` +
    `📌 *Status:* ${badge.text}\n` +
    (trx.note && trx.note !== "-" ? `📝 *Catatan:* ${trx.note}\n` : "") +
    `_Terima kasih telah berbelanja!_`
  );
}
