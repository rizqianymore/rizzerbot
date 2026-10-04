import { getCertTraceText } from "@/src/services/certtrace.js";

export default {
  name: "certtrace",
  aliases: ["crtsh", "certs", "crt", "sslcheck"],
  description: "Lacak subdomain & riwayat sertifikat domain via Certificate Transparency (crt.sh)",
  usage: "<domain, cth: example.com>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const input = (args[0] || "").trim();

    if (!input) {
      return reply(
        `🔒 *CERTIFICATE TRANSPARENCY TRACE*\n\n` +
        `Masukkan nama domain untuk melacak subdomain & sertifikatnya.\n\n` +
        `*Contoh:*\n` +
        `• \`${currentPrefix}certtrace example.com\`\n` +
        `• \`${currentPrefix}crt github.com\``
      );
    }

    await sendTyping();
    await reply(`🔍 Melacak jejak sertifikat *${input}* di crt.sh...`);

    try {
      const text = await getCertTraceText(input);
      return reply(text);
    } catch (err) {
      return reply(`❌ Gagal melacak sertifikat: ${err.message}`);
    }
  },
};
