import { parsePlat, enrichSamsat, formatPlatInfo } from "@/src/services/cekplat.js";
import { searchByPlate, searchByNik, isSamsatReady } from "@/src/services/samsatService.js";

export default {
  name: "cekplat",
  aliases: ["plat", "ceknopol", "nopol", "samsat", "ceknikplat"],
  description: "Cek data kendaraan SAMSAT / info plat nomor Indonesia",
  usage: "<plat nomor / NIK>",
  premiumOnly: true,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const rawInput = (args || []).join(" ").trim();

    if (!rawInput) {
      return reply(
        `*FORMAT PENGGUNAAN*\n\n` +
        `• Plat: \`${currentPrefix}cekplat B 1112 PYK\` (atau \`${currentPrefix}cekplat B1112PYK\`)\n` +
        `• NIK : \`${currentPrefix}cekplat 3171010101550005\``
      );
    }

    await sendTyping();

    const cleanInput = rawInput.replace(/\s+/g, "").toUpperCase();
    const isNik = /^\d{16}$/.test(cleanInput);
    const startTime = performance.now();

    try {

      if (isNik && isSamsatReady()) {
        const list = searchByNik(cleanInput);
        const latency = (performance.now() - startTime).toFixed(2);

        if (!list || list.length === 0) {
          return reply(`Data kendaraan dengan NIK ${cleanInput} tidak ditemukan (${latency} ms).`);
        }

        let text = `*DATA KENDARAAN (NIK)*\n\n`;
        text += `• NIK: ${cleanInput}\n`;
        text += `• Total: ${list.length} Kendaraan\n\n`;

        list.forEach((item, idx) => {
          text += `[${idx + 1}] ${item.number}\n`;
          text += `• Pemilik: ${item.name || '-'}\n`;
          text += `• Tipe: ${[item.brand, item.type].filter(Boolean).join(' ') || '-'}\n`;
          text += `• Rangka: ${item.vin || '-'}\n`;
          text += `• Mesin: ${item.engine || '-'}\n`;
          text += `• BPKB: ${item.bpkb || '-'}\n`;
          if (item.address) text += `• Alamat: ${item.address}\n`;
          text += `\n`;
        });

        text += `Query: ${latency} ms`;
        return reply(text.trim());
      }

      if (isSamsatReady()) {
        const data = searchByPlate(cleanInput);
        if (data) {
          const latency = (performance.now() - startTime).toFixed(2);
          const text =
            `*DATA KENDARAAN (SAMSAT)*\n\n` +
            `• Plat: ${data.number}\n` +
            `• Nama: ${data.name || '-'}\n` +
            `• NIK: ${data.nik || '-'}\n` +
            `• Alamat: ${data.address || '-'}\n` +
            `• Merk: ${data.brand || '-'}\n` +
            `• Tipe: ${data.type || '-'}\n` +
            `• Rangka: ${data.vin || '-'}\n` +
            `• Mesin: ${data.engine || '-'}\n` +
            `• BPKB: ${data.bpkb || '-'}\n` +
            `• Warna/Tahun: ${data.color || '-'} / ${data.year || '-'}\n\n` +
            `Query: ${latency} ms`;

          return reply(text);
        }
      }

      const parsed = parsePlat(rawInput);
      if (!parsed.valid) {
        return reply(
          `Data tidak ditemukan di SAMSAT dan format plat tidak valid: ${parsed.reason || "format salah"}\n\n` +
          `Contoh: \`${currentPrefix}cekplat B 1234 ABC\``
        );
      }

      await enrichSamsat(parsed);
      return reply(formatPlatInfo(parsed));
    } catch (err) {
      return reply(`Gagal memproses: ${err.message}`);
    }
  },
};
