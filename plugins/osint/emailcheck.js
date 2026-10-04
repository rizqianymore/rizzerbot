import dns from "node:dns/promises";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "sharklasers.com", "yopmail.com", "trashmail.com", "getairmail.com",
  "dispostable.com", "mohmal.com", "crazymailing.com", "fakemailgenerator.com",
  "temp-mail.org", "nada.ltd", "burnermail.io", "mytemp.email"
]);

export default {
  name: "emailcheck",
  aliases: ["checkemail", "emailrep", "osintemail", "mailcheck"],
  description: "Analisis OSINT email (validasi format, mail server MX, deteksi temp/disposable mail)",
  usage: "<email, cth: target@domain.com>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const email = (args[0] || "").trim().toLowerCase();

    if (!email) {
      return reply(
        `❌ Masukkan alamat email!\n` +
        `Contoh: \`${currentPrefix}emailcheck target@gmail.com\``
      );
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
    const match = email.match(emailRegex);

    if (!match) {
      return reply("❌ Format email tidak valid.");
    }

    const [, domain] = match;
    await sendTyping();
    await reply(`🔍 Melakukan analisa OSINT untuk *${email}*...`);

    const isDisposable = DISPOSABLE_DOMAINS.has(domain);

    let mxRecords = [];
    let mxStatus = "Tidak ada / Domain mati";
    try {
      const records = await dns.resolveMx(domain);
      if (records && records.length > 0) {
        mxRecords = records.sort((a, b) => a.priority - b.priority);
        mxStatus = "Aktif (Menerima Email)";
      }
    } catch {
      mxStatus = "Gagal resolve / Tidak aktif";
    }

    let hasSpf = false;
    let hasDmarc = false;
    try {
      const txt = await dns.resolveTxt(domain);
      const flattened = txt.map((t) => (Array.isArray(t) ? t.join("") : t));
      hasSpf = flattened.some((t) => t.toLowerCase().startsWith("v=spf1"));
    } catch {}

    try {
      const dmarcTxt = await dns.resolveTxt(`_dmarc.${domain}`);
      const flattened = dmarcTxt.map((t) => (Array.isArray(t) ? t.join("") : t));
      hasDmarc = flattened.some((t) => t.toLowerCase().startsWith("v=dmarc1"));
    } catch {}

    const lines = [
      `📧 *OSINT EMAIL ANALYZER*`,
      ``,
      `• *Email:* \`${email}\``,
      `• *Domain:* \`${domain}\``,
      `• *Format Valid:* ✅ Ya`,
      `• *Disposable / Temp Mail:* ${isDisposable ? "⚠️ YA (Email Sementara / Palsu)" : "✅ Tidak (Bukan Temp Mail)"}`,
      `• *Status Mail Server (MX):* ${mxRecords.length > 0 ? "✅ " + mxStatus : "❌ " + mxStatus}`,
      `• *Keamanan Email:*`,
      `   - SPF Record: ${hasSpf ? "✅ Ditemukan" : "⚠️ Tidak ada"}`,
      `   - DMARC Policy: ${hasDmarc ? "✅ Ditemukan" : "⚠️ Tidak ada"}`,
    ];

    if (mxRecords.length > 0) {
      lines.push(``, `📌 *Mail Server (MX Exchanger):*`);
      mxRecords.slice(0, 3).forEach((mx) => {
        lines.push(`   - ${mx.exchange} (Priority: ${mx.priority})`);
      });
      if (mxRecords.length > 3) {
        lines.push(`   _...dan ${mxRecords.length - 3} mail server lainnya_`);
      }
    }

    return reply(lines.join("\n"));
  },
};
