import {
  getDnsRecords,
  getWhois,
  getSubdomains,
  getIpGeo,
} from "@/src/services/network.js";

export default [
  {
    name: "dnslookup",
    aliases: ["dns", "nslookup"],
    description: "Cek catatan DNS domain (A, AAAA, MX, NS, TXT)",
    premiumOnly: false,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
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
          `─────────────────────────`,
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

        if (lines.length <= 2) {
          return reply(`❌ Tidak ditemukan record DNS publik untuk *${domain}*.`);
        }

        lines.push(`─────────────────────────`);
        await reply(lines.join("\n"));
      } catch (err) {
        await reply(`❌ Gagal DNS Lookup: ${err.message}`);
      }
    },
  },
  {
    name: "whois",
    aliases: ["whoislookup", "domaininfo"],
    description: "Cek informasi kepemilikan, registrar, & masa berlaku domain",
    premiumOnly: false,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
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
          `─────────────────────────`,
          `🌐 *Domain:* ${info.domain}`,
          `🏢 *Registrar:* ${info.registrar}`,
          `📅 *Didaftarkan:* ${info.createdDate}`,
          `🔄 *Diperbarui:* ${info.updatedDate}`,
          `⏳ *Kedaluwarsa:* ${info.expiryDate}`,
          info.abuseEmail !== "-" ? `🚨 *Abuse Email:* ${info.abuseEmail}` : "",
          info.registrarWhois !== "-" ? `🖥️ *Whois Server:* ${info.registrarWhois}` : "",
          `─────────────────────────`,
        ].filter(Boolean);

        await reply(lines.join("\n"));
      } catch (err) {
        await reply(`❌ Gagal WHOIS: ${err.message}`);
      }
    },
  },
  {
    name: "subdomainlookup",
    aliases: ["subdomain", "subdomains", "findsub"],
    description: "Mencari daftar subdomain aktif dari suatu domain",
    premiumOnly: false,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
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
          `─────────────────────────`,
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

        lines.push(`─────────────────────────`);
        await reply(lines.join("\n"));
      } catch (err) {
        await reply(`❌ Gagal mencari subdomain: ${err.message}`);
      }
    },
  },
  {
    name: "ipgeo",
    aliases: ["ipinfo", "iplookup", "checkip"],
    description: "Lacak lokasi, negara, ISP, dan info jaringan IP atau domain",
    premiumOnly: false,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const target = args[0];
      if (!target) {
        return reply("❌ Masukkan alamat IP atau domain! Contoh: *.ipgeo 1.1.1.1* atau *.ipgeo github.com*");
      }

      await reply(`🌍 Melacak informasi IP untuk *${target}*...`);

      try {
        const geo = await getIpGeo(target);

        const lines = [
          `🌍 *IP GEOLOCATION LOOKUP*`,
          `─────────────────────────`,
          `📌 *Query:* \`${geo.query}\``,
          `🏳️ *Negara:* ${geo.country} (${geo.countryCode})`,
          `🏙️ *Kota/Wilayah:* ${geo.city}, ${geo.regionName}`,
          `📮 *Kode Pos:* ${geo.zip || "-"}`,
          `🌐 *Koordinat:* ${geo.lat}, ${geo.lon}`,
          `🕒 *Timezone:* ${geo.timezone}`,
          `🏢 *ISP / Org:* ${geo.isp} (${geo.org || "-"})`,
          `🔢 *AS:* ${geo.as || "-"}`,
          `─────────────────────────`,
        ];

        await reply(lines.join("\n"));
      } catch (err) {
        await reply(`❌ Gagal melacak IP: ${err.message}`);
      }
    },
  },
];
