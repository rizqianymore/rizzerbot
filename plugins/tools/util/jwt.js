function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export default {
  name: "jwt",
  aliases: ["jwtdecode", "jwtparse"],
  description: "Decode dan analisis JSON Web Token (Header, Payload, & Status Expiration)",
  usage: "<token>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const token = args.join(" ").trim();

    if (!token) {
      return reply(
        `┌── JWT DECODER & INSPECTOR\n` +
          `│ Periksa isi Header, Payload, dan waktu kedaluwarsa token JWT.\n` +
          `└──\n\n` +
          `Format: ${p}jwt <token>\n` +
          `Contoh: ${p}jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
      );
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return reply(
        `❌ Format JWT tidak valid. JSON Web Token harus memiliki 3 bagian yang dipisahkan titik (\`header.payload.signature\`).`
      );
    }

    try {
      const rawHeader = base64UrlDecode(parts[0]);
      const rawPayload = base64UrlDecode(parts[1]);

      const headerObj = JSON.parse(rawHeader);
      const payloadObj = JSON.parse(rawPayload);

      let statusExpired = "Tidak diset";
      if (typeof payloadObj.exp === "number") {
        const expDate = new Date(payloadObj.exp * 1000);
        const now = new Date();
        const diffMs = expDate.getTime() - now.getTime();
        const diffMinutes = Math.round(diffMs / 60000);

        if (diffMs > 0) {
          statusExpired = `Aktif / Belum Expired (±${diffMinutes} mnt lagi)`;
        } else {
          statusExpired = `Sudah Expired (${Math.abs(diffMinutes)} mnt yang lalu)`;
        }
      }

      let text =
        `┌── HASIL DECODE JWT\n` +
        `│ Algoritma   : ${headerObj.alg || "-"}\n` +
        `│ Tipe Token  : ${headerObj.typ || "JWT"}\n` +
        `│ Status Exp  : ${statusExpired}\n` +
        `└──\n\n`;

      text += `├── [1] Header Metadata\n`;
      text += `\`\`\`json\n${JSON.stringify(headerObj, null, 2)}\n\`\`\`\n\n`;

      text += `└── [2] Payload Data Claims\n`;
      text += `\`\`\`json\n${JSON.stringify(payloadObj, null, 2)}\n\`\`\`\n\n`;

      text += `_Catatan: Signature dirahasiakan & parsing dilakukan murni lokal tanpa menyimpan data token._`;
      return reply(text);
    } catch (err) {
      return reply(`❌ Gagal membaca payload token: ${err.message}`);
    }
  },
};
