export function toTitleCase(str) {
  if (!str) return "";
  return str.replace(/\b\w+/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
  });
}

export function toSentenceCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
}

export function toCamelCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
}

export default {
  name: "case",
  aliases: ["capitalize", "titlecase", "upper", "lower", "sentencecase"],
  description: "Mengonversi dan merapikan format huruf teks (Uppercase, Title Case, Sentence Case, Lowercase).",
  usage: "<title/sentence/upper/lower/camel> <teks> atau balas pesan",
  example: "case title APAKABAR SEMUANYA",
  category: "Tools",
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping, commandName, activePrefix }) => {
    const quotedText =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text;

    let mode = "title";
    let text = "";

    
    if (["capitalize", "titlecase"].includes(commandName)) {
      mode = "title";
      text = args.join(" ").trim() || quotedText || "";
    } else if (["sentencecase", "sentence"].includes(commandName)) {
      mode = "sentence";
      text = args.join(" ").trim() || quotedText || "";
    } else if (commandName === "upper") {
      mode = "upper";
      text = args.join(" ").trim() || quotedText || "";
    } else if (commandName === "lower") {
      mode = "lower";
      text = args.join(" ").trim() || quotedText || "";
    } else {
      
      const firstArg = args[0]?.toLowerCase();
      const validModes = ["title", "capitalize", "sentence", "upper", "lower", "camel"];

      if (validModes.includes(firstArg)) {
        mode = firstArg === "capitalize" ? "title" : firstArg;
        text = args.slice(1).join(" ").trim() || quotedText || "";
      } else {
        mode = "title";
        text = args.join(" ").trim() || quotedText || "";
      }
    }

    if (!text) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `🔤 *Text Case Converter & Styler*\n\n` +
            `Gunakan perintah ini untuk merapikan teks kapital:\n\n` +
            `│ ${activePrefix}case title <teks> (Contoh: APA KABAR -> Apa Kabar)\n` +
            `│ ${activePrefix}case sentence <teks> (Contoh: APA KABAR. SAYA BAIK -> Apa kabar. Saya baik)\n` +
            `│ ${activePrefix}case lower <teks> (Semua huruf kecil)\n` +
            `│ ${activePrefix}case upper <teks> (Semua huruf besar)\n` +
            `│ ${activePrefix}case camel <teks> (Format camelCase)\n\n` +
            `_Tips: Anda juga bisa membalas/reply chat lalu ketik \`${activePrefix}case title\`_`,
        },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    let result = "";
    let modeLabel = "";

    switch (mode) {
      case "title":
        result = toTitleCase(text);
        modeLabel = "Title Case (Huruf Depan Kapital Tiap Kata)";
        break;
      case "sentence":
        result = toSentenceCase(text);
        modeLabel = "Sentence Case (Huruf Depan Tiap Kalimat)";
        break;
      case "upper":
        result = text.toUpperCase();
        modeLabel = "UPPERCASE";
        break;
      case "lower":
        result = text.toLowerCase();
        modeLabel = "lowercase";
        break;
      case "camel":
        result = toCamelCase(text);
        modeLabel = "camelCase";
        break;
      default:
        result = toTitleCase(text);
        modeLabel = "Title Case";
    }

    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text:
          `🔤 *Hasil Konversi Teks*\n\n` +
          `├─ 🏷️ *Tipe:* ${modeLabel}\n` +
          `└─ 📝 *Hasil:*\n\n${result}`,
      },
      { quoted: msg }
    );
  },
};
