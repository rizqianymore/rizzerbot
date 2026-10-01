// plugins/tools/dnslookup.js — perintah "dnslookup" (1 file = 1 perintah).
import {
  getDnsRecords,
  getWhois,
  getSubdomains,
  getIpGeo,
} from "@/src/services/network.js";



export default {
  "name": "dnslookup",
  "aliases": ["dns","nslookup"],
  "description": "Cek catatan DNS domain (A, AAAA, MX, NS, TXT)",
  "usage": "<domain>",
  "premiumOnly": false,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const domain = args[0];
      if (!domain) {
        return reply("❌ Masukkan nama domain! Contoh: *.dnslookup google.com*");
      }

      await reply(`🔍 Memeriksa record DNS untuk *${domain}*...`);

      try {
        const records = await getDnsRecords(domain);

        const lines = [
          `🌐 *DNS RECORDS: ${records.domain.toUpperCase()}*`,
        ];

        if (records.a.length > 0) {
          lines.push(`📌 *A Records (IPv4):*`);
          records.a.forEach((ip) => lines.push(`  • ${ip}`));
        }
        if (records.aaaa.length > 0) {
          lines.push(`📌 *AAAA Records (IPv6):*`);
          records.aaaa.forEach((ip) => lines.push(`  • ${ip}`));
        }
        if (records.cname.length > 0) {
          lines.push(`📌 *CNAME:*`);
          records.cname.forEach((c) => lines.push(`  • ${c}`));
        }
        if (records.mx.length > 0) {
          lines.push(`📧 *MX Records (Mail):*`);
          records.mx.forEach((mx) => lines.push(`  • ${mx}`));
        }
        if (records.ns.length > 0) {
          lines.push(`🏷️ *Name Servers (NS):*`);
          records.ns.forEach((ns) => lines.push(`  • ${ns}`));
        }
        if (records.txt.length > 0) {
          lines.push(`📄 *TXT Records:*`);
          records.txt.slice(0, 4).forEach((txt) => lines.push(`  • ${txt}`));
          if (records.txt.length > 4) {
            lines.push(`  _...dan ${records.txt.length - 4} TXT lainnya_`);
          }
        }

        if (lines.length <= 1) {
          return reply(`❌ Tidak ditemukan record DNS publik untuk *${domain}*.`);
        }

        await reply(lines.join("\n"));
      } catch (err) {
        await reply(`❌ Gagal DNS Lookup: ${err.message}`);
      }
    },
};
