// plugins/tools/subdomainlookup.js — perintah "subdomainlookup" (1 file = 1 perintah).
import {
  getDnsRecords,
  getWhois,
  getSubdomains,
  getIpGeo,
} from "@/src/services/network.js";



export default {
  "name": "subdomainlookup",
  "aliases": ["subdomain","subdomains","findsub"],
  "description": "Mencari daftar subdomain aktif dari suatu domain",
  "usage": "<domain>",
  "premiumOnly": true,
  "category": "OSINT",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const domain = args[0];
      if (!domain) {
        return reply("❌ Masukkan domain target! Contoh: *.subdomainlookup kemkes.go.id*");
      }

      await reply(`🔎 Memindai subdomain untuk *${domain}*...`);

      try {
        const data = await getSubdomains(domain);
        if (!data.subdomains || data.subdomains.length === 0) {
          return reply(`❌ Tidak ditemukan subdomain publik untuk *${domain}*.`);
        }

        const lines = [
          `🌐 *SUBDOMAIN SCANNER: ${data.domain.toUpperCase()}*`,
          `_Ditemukan ${data.count} subdomain_`,
        ];

        // Tampilkan 25 teratas
        const displayed = data.subdomains.slice(0, 25);
        for (let i = 0; i < displayed.length; i++) {
          const item = displayed[i];
          lines.push(`*${i + 1}.* \`${item.subdomain}\` → _${item.ip}_`);
        }

        if (data.count > 25) {
          lines.push(`\n_...dan ${data.count - 25} subdomain lainnya._`);
        }

        await reply(lines.join("\n"));
      } catch (err) {
        await reply(`❌ Gagal mencari subdomain: ${err.message}`);
      }
    },
};
