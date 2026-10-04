function stripCodeComments(sourceCode) {
  let inString = false;
  let stringChar = "";
  let inRegex = false;
  let inSingleComment = false;
  let inMultiComment = false;
  let output = "";

  for (let i = 0; i < sourceCode.length; i++) {
    const char = sourceCode[i];
    const nextChar = sourceCode[i + 1] || "";
    const prevChar = sourceCode[i - 1] || "";

    if (inSingleComment) {
      if (char === "\n" || char === "\r") {
        inSingleComment = false;
        output += char;
      }
      continue;
    }

    if (inMultiComment) {
      if (char === "*" && nextChar === "/") {
        inMultiComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (char === stringChar && prevChar !== "\\") {
        inString = false;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      inString = true;
      stringChar = char;
      output += char;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      inSingleComment = true;
      i++;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      inMultiComment = true;
      i++;
      continue;
    }

    output += char;
  }

  return output
    .split("\n")
    .filter((line, idx, arr) => line.trim() !== "" || (arr[idx - 1] && arr[idx - 1].trim() !== ""))
    .join("\n")
    .trim();
}

export default {
  name: "cleancomment",
  aliases: ["cleankomen", "hapuskomen", "delcomment", "nocomment", "stripcomment"],
  description: "Bersihkan seluruh komentar (// dan /* */) dari kode sumber pemrograman",
  usage: "<kode / reply pesan berisi kode>",
  category: "Tools",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";

    const quotedText =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      "";

    let rawCode = (args.join(" ") || quotedText).trim();

    if (!rawCode) {
      return reply(
        `🧹 *CODE COMMENT CLEANER*\n\n` +
        `Hapus semua baris komentar (\`//\` dan \`/* ... */\`) tanpa merusak string URL atau isi kode.\n\n` +
        `*Cara Penggunaan:*\n` +
        `1. Langsung ketik kode:\n` +
        `   \`${currentPrefix}cleancomment const x = 10; // ini komentar\`\n` +
        `2. Balas (quote) pesan yang berisi kode lalu ketik:\n` +
        `   \`${currentPrefix}cleancomment\``
      );
    }

    const isCodeblock = rawCode.startsWith("```");
    rawCode = rawCode.replace(/^```[a-zA-Z0-9_-]*\s*/i, "").replace(/```$/i, "").trim();

    await sendTyping();

    try {
      const cleaned = stripCodeComments(rawCode);

      if (!cleaned) {
        return reply("⚠️ Kode hanya berisi komentar sehingga setelah dibersihkan menjadi kosong.");
      }

      const diffCount = rawCode.length - cleaned.length;
      let text = `✨ *BERHASIL MEMBERSIHKAN KOMENTAR*\n`;
      text += `📊 Mengurangi: \`${diffCount} karakter\`\n\n`;
      text += `\`\`\`\n${cleaned}\n\`\`\``;

      return reply(text);
    } catch (err) {
      return reply(`❌ Gagal membersihkan komentar: ${err.message}`);
    }
  },
};
