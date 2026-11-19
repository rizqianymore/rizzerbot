import { getDnsRecords } from "@/src/services/network/network.js";

export default {
  name: "dnslookup",
  aliases: ["dns", "nslookup"],
  description: "Cek catatan DNS domain (A, AAAA, MX, NS, TXT)",
  usage: "<domain>",
  premiumOnly: true,
  cooldownMs: 8000,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const domain = args[0];
    if (!domain) {
      return reply(
        `*OSINT TOOLS - DNS LOOKUP*\n\n` +
          `Format: .dnslookup <domain>\n\n` +
          `Contoh: .dnslookup google.com`
      );
    }

    try {
      const records = await getDnsRecords(domain);

      let text = `*OSINT TOOLS*\n\nDomain: ${records.domain.toUpperCase()}\n`;
      if (records.a.length > 0) {
        text += `A (IPv4): ${records.a.slice(0, 3).join(", ")}\n`;
      }
      if (records.aaaa.length > 0) {
        text += `AAAA (IPv6): ${records.aaaa.slice(0, 2).join(", ")}\n`;
      }
      if (records.cname.length > 0) {
        text += `CNAME: ${records.cname.slice(0, 2).join(", ")}\n`;
      }
      if (records.mx.length > 0) {
        text += `MX: ${records.mx.slice(0, 2).join(", ")}\n`;
      }
      if (records.ns.length > 0) {
        text += `NS: ${records.ns.slice(0, 3).join(", ")}\n`;
      }
      if (records.txt.length > 0) {
        text += `TXT: ${records.txt[0].slice(0, 60)}...\n`;
      }

      return await reply(text.trim());
    } catch (err) {
      await reply(`Gagal DNS Lookup: ${err.message}`);
    }
  },
};
