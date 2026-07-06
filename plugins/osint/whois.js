import { fetchJson } from "@/lib/scraping.js";

export default {
  name: "whois",
  description: "Mencari detail pendaftaran/informasi WHOIS untuk suatu domain.",
  usage: "<domain>",
  example: "whois google.com",
  aliases: ["domaininfo", "whoislookup"],
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
          text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}whois <domain>\`\nContoh: \`${activePrefix}whois google.com\``,
        },
        { quoted: msg },
      );
    }

    // Clean protocol and paths if user paste full URL
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];

    try {
      const res = await fetchJson(
        `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      );
      if (res.status !== 200) {
        if (res.status === 404) {
          throw new Error(
            "Domain tidak ditemukan atau tidak didukung oleh RDAP.",
          );
        }
        throw new Error(`Gagal mengambil data WHOIS (HTTP ${res.status})`);
      }

      const data = res.data;
      const ldhName = data.ldhName || domain;

      const formatDate = (dateStr) => {
        try {
          if (!dateStr) return "-";
          const d = new Date(dateStr);
          return isNaN(d.getTime())
            ? "-"
            : d.toLocaleDateString("id-ID", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
        } catch (_) {
          return "-";
        }
      };

      // Extract registration, expiration, and update dates from events array
      let created = "-";
      let expired = "-";
      let updated = "-";

      if (Array.isArray(data.events)) {
        for (const ev of data.events) {
          if (ev.eventAction === "registration") {
            created = formatDate(ev.eventDate);
          } else if (ev.eventAction === "expiration") {
            expired = formatDate(ev.eventDate);
          } else if (
            ev.eventAction === "last changed" ||
            ev.eventAction === "last update of RDAP database"
          ) {
            updated = formatDate(ev.eventDate);
          }
        }
      }

      // Nameservers
      const nameservers = Array.isArray(data.nameservers)
        ? data.nameservers.map((ns) => ns.ldhName).join(", ")
        : "-";

      // Registrar/Entity
      let registrar = "-";
      if (Array.isArray(data.entities)) {
        const registrarEntity = data.entities.find(
          (ent) => ent.roles && ent.roles.includes("registrar"),
        );
        if (
          registrarEntity &&
          registrarEntity.vcardArray &&
          registrarEntity.vcardArray[1]
        ) {
          const fnField = registrarEntity.vcardArray[1].find(
            (field) => field[0] === "fn",
          );
          if (fnField) registrar = fnField[3];
        }
      }

      let replyText =
        `🔍 *Domain WHOIS OSINT*\n\n` +
        `• *Domain:* \`${ldhName}\`\n` +
        `• *Registrar:* ${registrar}\n` +
        `• *Tanggal Dibuat:* ${created}\n` +
        `• *Tanggal Kedaluwarsa:* ${expired}\n` +
        `• *Update Terakhir:* ${updated}\n` +
        `• *Name Servers:* ${nameservers}\n\n` +
        `_Dicari oleh: ${senderName}_\n\n⚡ _Via Kyros-MD API_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: replyText },
        { quoted: msg },
      );
    } catch (error) {
      console.error("Error WHOIS lookup:", error);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Terjadi kesalahan!*\n\n${error.message || "Gagal melakukan lookup WHOIS."}`,
        },
        { quoted: msg },
      );
    }
  },
};
