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
      return reply("Masukkan alamat IP atau domain! Contoh: `.ipgeo 1.1.1.1` atau `.iprecon google.com`");
    }

    try {
      const geo = await getIpGeo(target);

      const isProxy = geo.proxy === true;
      const isHosting = geo.hosting === true;
      const isMobile = geo.mobile === true;

      let tipeJaringan = "Rumahan / Kantor (Residential)";
      if (isHosting && isProxy) {
        tipeJaringan = "[!] VPN / Datacenter Proxy";
      } else if (isHosting) {
        tipeJaringan = " Cloud Datacenter / Server Hosting";
      } else if (isProxy) {
        tipeJaringan = " Anonymous Proxy / VPN";
      } else if (isMobile) {
        tipeJaringan = " Jaringan Seluler (Mobile Data)";
      }

      const lines = [
        ` *IP & THREAT INTEL RECON*`,
        ``,
        `• Target IP: \`${geo.query}\``,
        `• Negara: ${geo.country} (${geo.countryCode})`,
        `• Kota/Wilayah: ${geo.city}, ${geo.regionName}`,
        `• Kode Pos: ${geo.zip || "-"}`,
        `• Koordinat: \`${geo.lat}, ${geo.lon}\``,
        `• Timezone: ${geo.timezone}`,
        `• ISP: ${geo.isp}`,
        `• Organisasi: ${geo.org || "-"}`,
        `• AS Number: ${geo.as || "-"}`,
        ``,
        ` *DETEKSI KEAMANAN & ANCAMAN:*`,
        `• Tipe Jaringan: *${tipeJaringan}*`,
        `• VPN / Proxy: ${isProxy ? "[!] *TERDETEKSI (Ya)*" : "Aman (Tidak)"}`,
        `• Cloud Hosting / VPS: ${isHosting ? "[*] *Ya (Datacenter)*" : "Bukan Hosting"}`,
        `• Mobile Network: ${isMobile ? " Ya (Seluler)" : "[-] Bukan Seluler"}`,
      ];

      await reply(lines.join("\n"));
    } catch (err) {
      await reply(`Gagal melacak IP: ${err.message}`);
    }
  },
};
