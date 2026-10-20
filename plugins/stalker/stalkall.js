export default {
  name: "stalkall",
  aliases: ["cekall", "checkall", "stalksemua"],
  description: "Validasi format username & cek dasar (tanpa request API luar)",
  usage: "<username>",
  category: "Stalker",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, prefix }) => {
    const currentPrefix = prefix || ".";
    const username = (args[0] || "").trim().replace(/^@/, "");

    if (!username) {
      return reply(`📝 *Usage:* \`${currentPrefix}stalkall username\`\n💡 Contoh: \`${currentPrefix}stalkall torvalds\``);
    }

    // Validasi format username secara lokal (hanya regex, tidak ada API request)
    const isValid = /^[a-zA-Z0-9_.-]{3,30}$/.test(username);

    if (!isValid) {
      return reply(`❌ *Format username tidak valid!*\n\n\`${username}\`\n\n✅ Format yang benar:\n• 3-30 karakter\n• Huruf, angka, underscore (_), strip (.), dash (-)\n• Contoh: "github", "john_doe", "john-doe"`);
    }

    // Username valid - tampilkan pesan sukses
    await reply(
      `✅ *Username valid!*\n\n` +
      `Username \`${username}\` memiliki format yang benar.\n\n` +
      `📋 *Format ini umum digunakan di:* GitHub, GitLab, Bitbucket, dan platform developer lainnya.\n\n` +
      `💡 *Catatan:* Format valid hanya memastikan struktur username benar.\n` +
      `Untuk cek keberadaan di platform spesifik, gunakan perintah terpisih.\n\n` +
      `Contoh: \`${currentPrefix}stalkgithub ${username}\``
    );
  },
};