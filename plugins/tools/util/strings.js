import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";

function extractPrintableStrings(buffer, minLength = 6, maxCount = 40) {
  const strings = [];
  let current = [];

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    // Printable ASCII: 32 (space) to 126 (~)
    if (byte >= 32 && byte <= 126) {
      current.push(String.fromCharCode(byte));
    } else {
      if (current.length >= minLength) {
        strings.push(current.join(""));
      }
      current = [];
    }
  }

  if (current.length >= minLength) {
    strings.push(current.join(""));
  }

  // Filter kata-kata menarik (URL, email, path file, token, secret)
  const interesting = [];
  const normal = [];

  for (const s of strings) {
    if (
      /https?:\/\/|www\./i.test(s) ||
      /@[\w.-]+\.\w+/.test(s) ||
      /\/etc\/|\/var\/|[A-Z]:\\|\/home\//i.test(s) ||
      /api[_-]?key|token|secret|password|bearer|auth/i.test(s)
    ) {
      if (!interesting.includes(s)) interesting.push(s);
    } else {
      if (!normal.includes(s)) normal.push(s);
    }
  }

  return {
    totalFound: strings.length,
    interesting: interesting.slice(0, 25),
    samples: normal.slice(0, Math.max(0, maxCount - interesting.length)),
  };
}

export default {
  name: "strings",
  aliases: ["binstrings", "extractstrings", "dumpstrings"],
  description: "Ekstrak teks ASCII/URL/Token tersembunyi dari file biner (Forensik Biner)",
  usage: "(reply dokumen/audio/gambar/APK)",
  category: "Tools & Media",
  cooldownMs: 5000,
  run: async (sock, msg, args, context) => {
    const target = findDownloadableTarget(msg);
    if (!target) {
      return context.reply("Kirim atau reply file dokumen/biner yang ingin di-ekstrak teksnya.");
    }

    const minLen = Math.max(4, Math.min(20, parseInt(args[0], 10) || 6));
    await context.sendTyping();

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 8 * 1024 * 1024 });
    } catch (err) {
      return context.reply(`Gagal mengunduh file: ${err.message}`);
    }

    if (!buffer || buffer.length === 0) {
      return context.reply("File biner kosong.");
    }

    const result = extractPrintableStrings(buffer, minLen, 35);
    if (result.totalFound === 0) {
      return context.reply(`Tidak ditemukan string ASCII beruntun (minimal ${minLen} karakter) dalam file.`);
    }

    const lines = [
      "*BINARY STRINGS FORENSIC DUMP*",
      `Ukuran File : ${(buffer.length / 1024).toFixed(2)} KB`,
      `Total String: ${result.totalFound} string (min ${minLen} char)`,
    ];

    if (result.interesting.length > 0) {
      lines.push(
        "",
        "*Pola Mencurigakan / Menarik (URL, Path, Token):*",
        result.interesting.map((s) => `• \`${s.slice(0, 100)}\``).join("\n")
      );
    }

    if (result.samples.length > 0) {
      lines.push(
        "",
        "*Sample String Biner Lainnya:*",
        result.samples.slice(0, 15).map((s) => `• \`${s.slice(0, 80)}\``).join("\n")
      );
    }

    return context.reply(lines.join("\n"));
  },
};
