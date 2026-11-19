import { request } from "@/src/utils/request.js";

export default {
  name: "asn",
  aliases: ["aslookup", "asntrace"],
  description: "Cek info Autonomous System (ASN) dan blok IP penyedia hosting/ISP",
  usage: "<ip atau AS-Number>",
  category: "OSINT",
  cooldownMs: 5000,
  run: async (_sock, _msg, args, context) => {
    let query = (args[0] || "").trim();
    if (!query) {
      return context.reply(
        `*OSINT TOOLS - ASN LOOKUP*\n\n` +
          `Format: ${context.prefix || "."}asn <ip / AS number>\n\n` +
          `Contoh: ${context.prefix || "."}asn 1.1.1.1`
      );
    }

    await context.sendTyping();

    // Normalisasi jika user ketik AS1234
    if (/^as\d+$/i.test(query)) {
      query = query.toUpperCase();
    }

    try {
      const raw = await request.text(`https://api.hackertarget.com/aslookup/?q=${encodeURIComponent(query)}`, {
        timeout: 10000,
      });

      if (!raw || raw.includes("error") || raw.includes("No ASN")) {
        return context.reply(`Tidak ditemukan data ASN untuk kueri: ${query}`);
      }

      const lines = raw.trim().split("\n");
      const firstLine = lines[0];
      const parts = firstLine.replace(/"/g, "").split(",");

      if (parts.length >= 4) {
        const out =
          `*OSINT TOOLS*\n\n` +
          `ASN: AS${parts[1]}\n` +
          `Target IP: ${parts[0]}\n` +
          `IP Range: ${parts[2]}\n` +
          `Organisasi: ${parts.slice(3).join(",").trim()}`;
        return context.reply(out);
      } else if (parts.length >= 2) {
        const out = `*OSINT TOOLS*\n\nASN: AS${parts[0]}\nOperator: ${parts.slice(1).join(",").trim()}`;
        return context.reply(out);
      }
      return context.reply(`Data ASN:\n${raw}`);
    } catch (err) {
      return context.reply(`Gagal mencari data ASN: ${err.message}`);
    }
  },
};
