import { getWhois, cleanDomain } from "@/src/services/network/network.js";

export default {
  name: "whois",
  aliases: ["whoislookup", "domaininfo"],
  description: "Cek informasi kepemilikan, registrar, & masa berlaku domain",
  usage: "<domain>",
  premiumOnly: true,
  cooldownMs: 8000,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    const raw = (args || []).join(" ").trim() || args[0];
    if (!raw) {
      return reply("Masukkan nama domain! Contoh: *.whois openai.com*");
    }
    const domain = cleanDomain(raw);
    if (!domain) return reply("Domain tidak valid! Contoh: *.whois openai.com*");
    await sendTyping();
    await reply(`Memeriksa data WHOIS untuk *${domain}*...`);

    try {
      const info = await getWhois(domain);

      const lines = [
        `*WHOIS DOMAIN INFORMATION*`,
        `*Domain:* ${info.domain}`,
        `*Registrar:* ${info.registrar}`,
        `*Didaftarkan:* ${info.createdDate}`,
        `*Diperbarui:* ${info.updatedDate}`,
        `*Kedaluwarsa:* ${info.expiryDate}`,
        info.abuseEmail !== "-" ? `*Abuse Email:* ${info.abuseEmail}` : "",
        info.registrarWhois !== "-" ? `*Whois Server:* ${info.registrarWhois}` : "",
      ].filter(Boolean);

      await reply(lines.join("\n"));
    } catch (err) {
      await reply(`Gagal WHOIS: ${err.message}`);
    }
  },
};
