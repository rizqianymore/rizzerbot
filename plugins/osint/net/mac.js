import { request } from "@/src/utils/request.js";

function cleanMac(input) {
  return input.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

export default {
  name: "mac",
  aliases: ["maclookup", "cekmac", "oui"],
  description: "Cari vendor dan produsen perangkat dari MAC Address (Open IEEE Database)",
  usage: "<mac-address>",
  category: "OSINT",
  cooldownMs: 3000,
  run: async (_sock, _msg, args, context) => {
    const rawInput = args.join(" ").trim();
    if (!rawInput) {
      return context.reply(`Gunakan format:\n${context.prefix || "."}mac <mac-address>\n\nContoh:\n${context.prefix || "."}mac 00:1A:2B:3C:4D:5E`);
    }

    const cleaned = cleanMac(rawInput);
    if (cleaned.length < 6) {
      return context.reply("Format MAC address tidak valid. Masukkan minimal 6 karakter hex (contoh: 00:1A:2B).");
    }

    await context.sendTyping();

    const formattedMac = cleaned.slice(0, 12).match(/.{1,2}/g).join(":");

    try {
      const vendor = await request.text(`https://api.macvendors.com/${encodeURIComponent(formattedMac)}`, {
        timeout: 8000,
      });

      if (!vendor || vendor.includes("Not Found") || vendor.includes("error")) {
        return context.reply(`Vendor untuk MAC address \`${formattedMac}\` tidak ditemukan di database OUI publik.`);
      }

      const out = [
        `*MAC ADDRESS VENDOR LOOKUP*`,
        `MAC Address : \`${formattedMac}\``,
        `Prefix OUI  : ${formattedMac.slice(0, 8)}`,
        `Vendor/Manufaktur: ${vendor.trim()}`,
      ].join("\n");

      return context.reply(out);
    } catch (err) {
      if (err?.message?.includes("404")) {
        return context.reply(`Vendor untuk MAC address \`${formattedMac}\` tidak ditemukan di database OUI publik.`);
      }
      return context.reply(`Gagal mencari informasi MAC: ${err.message}`);
    }
  },
};
