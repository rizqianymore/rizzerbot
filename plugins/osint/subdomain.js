import { fetchJson } from "@/src/utils/scraping.js";

export default {
  name: "subdomain",
  description: "Mencari subdomain dari suatu target domain via Certificate Transparency logs (crt.sh).",
  usage: "<domain>",
  example: "subdomain target.com",
  aliases: ["subdomains", "findsubdomain"],
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix, senderName } = context;
    await sendTyping();

    let domain = args[0];
    if (!domain) {
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}subdomain <domain>\`\nContoh: \`${activePrefix}subdomain target.com\``,
        },
        { quoted: msg }
      );
    }

    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];

    try {
      const url = `https://crt.sh/?q=%.${encodeURIComponent(domain)}&output=json`;
      const res = await fetchJson(url);

      if (!Array.isArray(res.data) || res.data.length === 0) {
        return sock.sendMessage(
          msg.key.remoteJid,
          { text: `⚠️ Tidak ditemukan subdomain untuk *${domain}* pada log sertifikat.` },
          { quoted: msg }
        );
      }

      const subdomainsSet = new Set();
      for (const item of res.data) {
        if (item.name_value) {
          const names = item.name_value.split("\n");
          for (const name of names) {
            const clean = name.trim().toLowerCase();
            if (!clean.includes("*") && clean.endsWith(domain)) {
              subdomainsSet.add(clean);
            }
          }
        }
      }

      const subdomains = Array.from(subdomainsSet).sort();
      if (subdomains.length === 0) {
        return sock.sendMessage(
          msg.key.remoteJid,
          { text: `⚠️ Tidak ditemukan subdomain publik untuk *${domain}*.` },
          { quoted: msg }
        );
      }

      const displayList = subdomains.slice(0, 30);
      const isTruncated = subdomains.length > 30;

      let replyText =
        `🌐 *Subdomain OSINT Enumeration*\n\n` +
        `• *Target Domain:* \`${domain}\`\n` +
        `• *Total Subdomain Ditemukan:* ${subdomains.length}\n\n` +
        `📌 *Daftar Subdomain:* \n` +
        displayList.map((s) => `  • ${s}`).join("\n") +
        (isTruncated ? `\n\n_...dan ${subdomains.length - 30} subdomain lainnya._` : "") +
        `\n\n_Dicari oleh: ${senderName}_\n\n⚡ _Via Kyros-MD OSINT_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: replyText },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ *Gagal mencari subdomain:* ${err.message || err}` },
        { quoted: msg }
      );
    }
  },
};
