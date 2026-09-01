import { fetchBuffer } from "@/src/utils/scraping.js";

export default {
  name: "trx",
  aliases: ["transaksi", "receipt", "tx"],
  description: "Membuat bukti transaksi via API Worker.",
  usage: "<item> | <harga> | [metode] | [pembeli] | [hp]",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping, sendUsage }) => {
    const text = args.join(" ");
    if (!text) return await sendUsage();

    let parts = [];
    if (text.includes("|")) {
      parts = text.split("|").map((p) => p.trim());
    } else if (text.includes(",")) {
      parts = text.split(",").map((p) => p.trim());
    } else {
      parts = [text];
    }

    const [item, price, method, buyer, phone] = parts;
    if (!item || !price) return await sendUsage();

    await sendTyping();

    try {
      const baseUrl = "https://trx-maker.rakarizqi-cv.workers.dev/";
      const params = new URLSearchParams({
        product: item,
        amount: price.replace(/\D/g, ""),
        date: new Date().toISOString().split("T")[0],
        buyer: buyer || "Pelanggan",
        phone: phone || "08123456789",
        method: method || "QRIS",
      });

      const workerUrl = `${baseUrl}?${params.toString()}`;

      const microUrl = `https:

      const buffer = await fetchBuffer(microUrl);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: buffer,
          caption: `📸 *Bukti Transaksi*\n\n🛍️ *Produk:* ${item}\n💵 *Total:* ${price}\n💳 *Metode:* ${method || "QRIS"}\n\n⚡ _Via Kyros-MD API_`,
        },
        { quoted: msg },
      );
    } catch (err) {
      console.error(err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "❌ Gagal mengambil struk dari API." },
        { quoted: msg },
      );
    }
  },
};
