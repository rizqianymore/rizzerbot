import { getShopConfig, updateShopConfig } from "@/src/services/shop/shop.js";

export default {
  name: "payment",
  aliases: ["metodebayar", "payinfo", "pembayaran"],
  description: "Lihat dan atur informasi rekening/metode pembayaran toko",
  usage: "[set <info pembayaran>]",
  category: "Store",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, prefix, isOwner }) => {
    const p = prefix || ".";
    const sub = (args[0] || "").toLowerCase();

    if (sub === "set" || sub === "atur") {
      if (!isOwner) return reply("Hanya Owner yang dapat mengubah informasi pembayaran.");
      const info = args.slice(1).join(" ").trim();
      if (!info) {
        return reply(`Ketik informasi pembayaran baru.\nContoh: \`${p}payment set BCA: 1234567890 a/n Toko\``);
      }
      updateShopConfig({ paymentInfo: info });
      return reply(`*INFORMASI PEMBAYARAN DIPERBARUI:*\n\n${info}`);
    }

    const config = getShopConfig();
    let out = `*METODE PEMBAYARAN RESMI*\n\n`;
    out += `${config.paymentInfo || "Belum ada informasi pembayaran yang disetel."}\n\n`;
    out += `_Setelah transfer, simpan bukti struk dan konfirmasi ke Admin/Owner._`;

    if (isOwner) {
      out += `\n\n_Owner: Ketik \`${p}payment set <info>\` untuk mengubah teks pembayaran._`;
    }

    return reply(out.trim());
  },
};
