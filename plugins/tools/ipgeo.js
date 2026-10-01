// plugins/tools/ipgeo.js — perintah "ipgeo" (1 file = 1 perintah).
import {
  getDnsRecords,
  getWhois,
  getSubdomains,
  getIpGeo,
} from "@/src/services/network.js";



export default {
  "name": "ipgeo",
  "aliases": ["ipinfo","iplookup","checkip"],
  "description": "Lacak lokasi, negara, ISP, dan info jaringan IP atau domain",
  "usage": "<ip / domain>",
  "premiumOnly": false,
  "category": "Tools",
  "run": async (sock, msg, args, { reply, sendTyping }) => {
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
          `📌 *Query:* \`${geo.query}\``,
          `🏳️ *Negara:* ${geo.country} (${geo.countryCode})`,
          `🏙️ *Kota/Wilayah:* ${geo.city}, ${geo.regionName}`,
          `📮 *Kode Pos:* ${geo.zip || "-"}`,
          `🌐 *Koordinat:* ${geo.lat}, ${geo.lon}`,
          `🕒 *Timezone:* ${geo.timezone}`,
          `🏢 *ISP / Org:* ${geo.isp} (${geo.org || "-"})`,
          `🔢 *AS:* ${geo.as || "-"}`,
        ];

        await reply(lines.join("\n"));
      } catch (err) {
        await reply(`❌ Gagal melacak IP: ${err.message}`);
      }
    },
};
