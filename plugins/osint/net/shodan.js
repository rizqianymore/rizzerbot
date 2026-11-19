import { request } from "@/src/utils/request.js";

function isIpv4(str) {
  const parts = str.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

export default {
  name: "shodan",
  aliases: ["internetdb", "cvecheck"],
  description: "Cek port terbuka, CPE, dan CVE vuln dari IP via Shodan InternetDB (Open Source)",
  usage: "<ip>",
  category: "OSINT",
  cooldownMs: 5000,
  run: async (_sock, _msg, args, context) => {
    const ip = (args[0] || "").trim();
    if (!ip) {
      return context.reply(
        `┌── SHODAN INTERNETDB SCAN\n` +
          `│ Format: ${context.prefix || "."}shodan <ip>\n` +
          `└──\n\n` +
          `Contoh: ${context.prefix || "."}shodan 1.1.1.1`
      );
    }

    if (!isIpv4(ip)) {
      return context.reply("Masukkan format alamat IPv4 yang valid (contoh: 1.1.1.1).");
    }

    await context.sendTyping();

    try {
      const res = await request.json(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, {
        timeout: 10000,
      });

      if (!res || !res.ip) {
        return context.reply(`Tidak ada data Shodan InternetDB ditemukan untuk IP ${ip}.`);
      }

      const ports = Array.isArray(res.ports) && res.ports.length > 0 ? res.ports.join(", ") : "Tidak terdeteksi";
      const tags = Array.isArray(res.tags) && res.tags.length > 0 ? res.tags.join(", ") : "-";
      const vulns =
        Array.isArray(res.vulns) && res.vulns.length > 0 ? res.vulns.slice(0, 5).join(", ") : "Tidak terdeteksi";

      const out =
        `┌── SHODAN: ${res.ip}\n` +
        `│ Port Terbuka: ${ports}\n` +
        `│ Tags: ${tags}\n` +
        `│ Kerentanan (CVE): ${vulns}\n` +
        `└──`;

      return context.reply(out);
    } catch (err) {
      if (err?.message?.includes("404")) {
        return context.reply(`IP ${ip} belum terindeks atau tidak memiliki port publik aktif di Shodan InternetDB.`);
      }
      return context.reply(`Gagal memeriksa Shodan InternetDB: ${err.message || err}`);
    }
  },
};
