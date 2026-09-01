import dns from "dns/promises";

export default {
  name: "dnslookup",
  description: "Mencari catatan DNS (A, AAAA, MX, NS, TXT, CNAME) untuk suatu domain.",
  usage: "<domain>",
  example: "dnslookup google.com",
  aliases: ["dns", "dnsinfo"],
  category: "OSINT",
  premiumOnly: false,
  ownerOnly: true,
  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix, senderName } = context;
    await sendTyping();

    let domain = args[0];
    if (!domain) {
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}dnslookup <domain>\`\nContoh: \`${activePrefix}dnslookup google.com\``,
        },
        { quoted: msg }
      );
    }

    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];

    try {
      const records = {};

      try { records.A = await dns.resolve4(domain); } catch (_) { records.A = []; }
      try { records.AAAA = await dns.resolve6(domain); } catch (_) { records.AAAA = []; }
      try { records.MX = await dns.resolveMx(domain); } catch (_) { records.MX = []; }
      try { records.NS = await dns.resolveNs(domain); } catch (_) { records.NS = []; }
      try { records.TXT = await dns.resolveTxt(domain); } catch (_) { records.TXT = []; }

      const textA = records.A.length > 0 ? records.A.join(", ") : "-";
      const textAAAA = records.AAAA.length > 0 ? records.AAAA.join(", ") : "-";
      const textMX = records.MX.length > 0 ? records.MX.map((m) => `${m.exchange} (prio:${m.priority})`).join("\n  • ") : "-";
      const textNS = records.NS.length > 0 ? records.NS.join(", ") : "-";
      const textTXT = records.TXT.length > 0 ? records.TXT.map((t) => t.join(" ")).slice(0, 3).join("\n  • ") : "-";

      let replyText =
        `🔍 *DNS Records OSINT*\n\n` +
        `• *Target Domain:* \`${domain}\`\n\n` +
        `📌 *A Records (IPv4):*\n  • ${textA}\n\n` +
        `📌 *AAAA Records (IPv6):*\n  • ${textAAAA}\n\n` +
        `📌 *MX Records (Mail):*\n  • ${textMX}\n\n` +
        `📌 *Name Servers (NS):*\n  • ${textNS}\n\n` +
        `📌 *TXT Records:*\n  • ${textTXT}\n\n` +
        `_Dicari oleh: ${senderName}_\n\n⚡ _Via Kyros-MD OSINT_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: replyText },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ *Gagal melakukan DNS lookup:* ${err.message || err}` },
        { quoted: msg }
      );
    }
  },
};
