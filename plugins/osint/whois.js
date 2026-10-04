// plugins/tools/whois.js — perintah "whois" (1 file = 1 perintah).
import {
  getDnsRecords,
  getWhois,
  getSubdomains,
  getIpGeo,
} from "@/src/services/network.js";



export default {
  "name": "whois",
  "aliases": ["whoislookup","domaininfo"],
  "description": "Cek informasi kepemilikan, registrar, & masa berlaku domain",
  "usage": "<domain>",
  "premiumOnly": true,
  "category": "OSINT",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const domain = args[0];
      if (!domain) {
        return reply("❌ Masukkan nama domain! Contoh: *.whois openai.com*");
      }

      await reply(`🔍 Memeriksa data WHOIS untuk *${domain}*...`);

      try {
        const info = await getWhois(domain);

        const lines = [
          `📋 *WHOIS DOMAIN INFORMATION*`,
          `🌐 *Domain:* ${info.domain}`,
          `🏢 *Registrar:* ${info.registrar}`,
          `📅 *Didaftarkan:* ${info.createdDate}`,
          `🔄 *Diperbarui:* ${info.updatedDate}`,
          `⏳ *Kedaluwarsa:* ${info.expiryDate}`,
          info.abuseEmail !== "-" ? `🚨 *Abuse Email:* ${info.abuseEmail}` : "",
          info.registrarWhois !== "-" ? `🖥️ *Whois Server:* ${info.registrarWhois}` : "",
        ].filter(Boolean);

        await reply(lines.join("\n"));
      } catch (err) {
        await reply(`❌ Gagal WHOIS: ${err.message}`);
      }
    },
};
