import { request } from "@/src/utils/request.js";

export default {
  name: "asn",
  aliases: ["aslookup", "asntrace"],
  description: "Cek info Autonomous System (ASN) dan blok IP penyedia hosting/ISP",
  usage: "<ip atau AS-Number>",
  category: "OSINT",
  cooldownMs: 5000,
  run: async (_sock, _msg, args, context) => {
    let query = (args[0] || "").trim();
    if (!query) {
      return context.reply(
        `Gunakan format:\n` +
        `${context.prefix || "."}asn <ip atau nomor-as>\n\n` +
        `Contoh:\n` +
        `• ${context.prefix || "."}asn 1.1.1.1\n` +
        `• ${context.prefix || "."}asn AS7713 (Telkom Indonesia)`
      );
    }

    await context.sendTyping();

    // Normalisasi jika user ketik AS1234
    if (/^as\d+$/i.test(query)) {
      query = query.toUpperCase();
    }

    try {
      const raw = await request.text(`https://api.hackertarget.com/aslookup/?q=${encodeURIComponent(query)}`, {
        timeout: 10000,
      });

      if (!raw || raw.includes("error") || raw.includes("No ASN")) {
        return context.reply(`Tidak ditemukan data ASN untuk kueri: \`${query}\``);
      }

      const lines = raw.trim().split("\n");
      const firstLine = lines[0];

      // Format IP lookup: "1.1.1.1","13335","1.1.1.0/24","CLOUDFLARENET, US"
      // Format AS lookup: "7713","TELKOMNET-AS-AP PT Telekomunikasi Indonesia, ID"
      const parts = firstLine.replace(/"/g, "").split(",");

      if (parts.length >= 4) {
        // Query berupa IP
        const out = [
          `*AUTONOMOUS SYSTEM (ASN) LOOKUP*`,
          `Target IP   : ${parts[0]}`,
          `ASN Number  : AS${parts[1]}`,
          `IP Prefix   : ${parts[2]}`,
          `Organisasi  : ${parts[3]}`,
          `Negara      : ${parts[4] || "-"}`,
        ].join("\n");
        return context.reply(out);
      } else if (parts.length >= 2) {
        // Query berupa ASN
        const asnNum = parts[0];
        const org = parts.slice(1).join(", ");
        const subnets = lines.slice(1).filter((l) => l.trim().length > 0);

        const out = [
          `*AUTONOMOUS SYSTEM (ASN) DETAIL*`,
          `ASN Number : AS${asnNum}`,
          `Organisasi : ${org.trim()}`,
          `Total Blok : ${subnets.length} subnet terdaftar`,
          ``,
          `*Sample IP Subnet Terdaftar:*`,
          subnets.slice(0, 10).map((s) => `  - ${s}`).join("\n"),
        ];

        if (subnets.length > 10) {
          out.push(`  ... dan ${subnets.length - 10} subnet lainnya.`);
        }

        return context.reply(out.join("\n"));
      }

      return context.reply(`Hasil pencarian ASN:\n${raw.slice(0, 500)}`);
    } catch (err) {
      return context.reply(`Gagal mencari data ASN: ${err.message}`);
    }
  },
};
