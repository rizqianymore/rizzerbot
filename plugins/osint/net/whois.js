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
      return reply(
        `*OSINT TOOLS - WHOIS*\n\n` +
          `Format: .whois <domain>\n\n` +
          `Contoh: .whois openai.com`
      );
    }
    const domain = cleanDomain(raw);
    if (!domain) return reply("Domain tidak valid! Contoh: .whois openai.com");
    await sendTyping();

    try {
      const info = await getWhois(domain);

      let text =
        `*OSINT TOOLS*\n\n` +
        `Domain: ${info.domain}\n` +
        `Registrar: ${info.registrar}\n` +
        `Didaftarkan: ${info.createdDate}\n` +
        `Diperbarui: ${info.updatedDate}\n` +
        `Kedaluwarsa: ${info.expiryDate}\n`;
      if (info.abuseEmail !== "-") text += `Abuse Email: ${info.abuseEmail}\n`;
      if (info.registrarWhois !== "-") text += `Whois Server: ${info.registrarWhois}\n`;

      await reply(text.trim());
    } catch (err) {
      await reply(`Gagal WHOIS: ${err.message}`);
    }
  },
};
