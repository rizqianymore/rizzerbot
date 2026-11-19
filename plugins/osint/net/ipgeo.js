import { getIpGeo } from "@/src/services/network/network.js";

export default {
  name: "ipgeo",
  aliases: ["ipinfo", "iplookup", "checkip", "iprecon"],
  description: "Lacak lokasi, ISP, serta deteksi VPN / Proxy / Datacenter IP atau domain",
  usage: "<ip / domain>",
  premiumOnly: true,
  cooldownMs: 8000,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const target = args[0];
    if (!target) {
      return reply(
        `┌── OSINT IP & RECON\n` +
        `│ Format: .ipgeo <ip / domain>\n` +
        `└──\n\n` +
        `Contoh: .ipgeo 1.1.1.1`
      );
    }

    try {
      const geo = await getIpGeo(target);

      const isProxy = geo.proxy === true;
      const isHosting = geo.hosting === true;
      const isMobile = geo.mobile === true;

      let tipeJaringan = "Residential (Rumahan/Kantor)";
      if (isHosting && isProxy) {
        tipeJaringan = "VPN / Datacenter Proxy";
      } else if (isHosting) {
        tipeJaringan = "Cloud Datacenter / Server";
      } else if (isProxy) {
        tipeJaringan = "Anonymous Proxy / VPN";
      } else if (isMobile) {
        tipeJaringan = "Jaringan Seluler (Mobile)";
      }

      const text =
        `┌── RECON: ${geo.query}\n` +
        `│ Lokasi: ${geo.city}, ${geo.regionName}, ${geo.country} (${geo.countryCode})\n` +
        `│ Koordinat: ${geo.lat}, ${geo.lon}\n` +
        `│ Zona Waktu: ${geo.timezone}\n` +
        `│ ISP: ${geo.isp}\n` +
        `│ Organisasi: ${geo.org || "-"}\n` +
        `│ ASN: ${geo.as || "-"}\n` +
        `│ Tipe Jaringan: ${tipeJaringan}\n` +
        `│ Proxy / VPN: ${isProxy ? "TERDETEKSI" : "Aman (Tidak)"}\n` +
        `│ Hosting / VPS: ${isHosting ? "Ya (Datacenter)" : "Bukan Hosting"}\n` +
        `└──`;

      await reply(text);
    } catch (err) {
      await reply(`Gagal melacak IP: ${err.message}`);
    }
  },
};
