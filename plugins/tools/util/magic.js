import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";

const SIGNATURES = [
  // Eksekusi / Payload
  { sig: [0x4d, 0x5a], ext: "EXE / DLL", desc: "Windows Executable (PE32/PE64)", category: "Executable" },
  { sig: [0x7f, 0x45, 0x4c, 0x46], ext: "ELF", desc: "Linux / Android Executable Binary", category: "Executable" },
  { sig: [0xca, 0xfe, 0xba, 0xbe], ext: "CLASS / MACH-O", desc: "Java Bytecode / macOS Mach-O Fat Binary", category: "Executable" },
  { sig: [0x64, 0x65, 0x78, 0x0a], ext: "DEX", desc: "Android Dalvik Executable", category: "Android" },

  // Arsip / Dokumen
  { sig: [0x50, 0x4b, 0x03, 0x04], ext: "ZIP / APK / DOCX", desc: "ZIP Archive / APK / Office OpenXML Document", category: "Archive" },
  { sig: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], ext: "RAR", desc: "RAR Archive", category: "Archive" },
  { sig: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], ext: "7Z", desc: "7-Zip Compressed Archive", category: "Archive" },
  { sig: [0x1f, 0x8b, 0x08], ext: "GZ / TGZ", desc: "Gzip Compressed Archive", category: "Archive" },
  { sig: [0x25, 0x50, 0x44, 0x46], ext: "PDF", desc: "Adobe Portable Document Format", category: "Document" },
  { sig: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00], ext: "SQLITE", desc: "SQLite 3 Database File", category: "Database" },

  // Gambar
  { sig: [0xff, 0xd8, 0xff], ext: "JPEG / JPG", desc: "JPEG Image", category: "Image" },
  { sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: "PNG", desc: "Portable Network Graphics", category: "Image" },
  { sig: [0x47, 0x49, 0x46, 0x38], ext: "GIF", desc: "Graphics Interchange Format", category: "Image" },
  { sig: [0x52, 0x49, 0x46, 0x46], ext: "WEBP / WAV / AVI", desc: "RIFF Container (WebP / Audio WAV)", category: "Media" },

  // Jaringan / Dump
  { sig: [0xd4, 0xc3, 0xb2, 0xa1], ext: "PCAP", desc: "Network Packet Capture (Wireshark PCAP)", category: "Network" },
  { sig: [0x0a, 0x0d, 0x0d, 0x0a], ext: "PCAPNG", desc: "Next Generation Packet Capture (PCAPNG)", category: "Network" },
];

function identifyMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return null;

  for (const item of SIGNATURES) {
    if (buffer.length >= item.sig.length) {
      let match = true;
      for (let i = 0; i < item.sig.length; i++) {
        if (buffer[i] !== item.sig[i]) {
          match = false;
          break;
        }
      }
      if (match) return item;
    }
  }

  return null;
}

export default {
  name: "magic",
  aliases: ["filetype", "identifyfile", "magicbytes"],
  description: "Deteksi tipe asli file berdasarkan header biner Magic Bytes (Anti-Spoofing File)",
  usage: "(reply dokumen/media apa saja)",
  category: "Tools & Media",
  cooldownMs: 3000,
  run: async (sock, msg, _args, context) => {
    const target = findDownloadableTarget(msg);
    if (!target) {
      return context.reply("Kirim atau reply file dokumen/media yang ingin dideteksi tipe aslinya.");
    }

    await context.sendTyping();

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 5 * 1024 * 1024 });
    } catch (err) {
      return context.reply(`Gagal mengunduh file: ${err.message}`);
    }

    if (!buffer || buffer.length === 0) {
      return context.reply("File kosong.");
    }

    const hexDump = Array.from(buffer.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");

    const asciiDump = Array.from(buffer.slice(0, 16))
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
      .join("");

    const detected = identifyMagicBytes(buffer);

    const out = [
      `*MAGIC BYTES (FILE SIGNATURE ANALYSIS)*`,
      `Ukuran File : ${(buffer.length / 1024).toFixed(2)} KB`,
      `Header Hex  : \`${hexDump}\``,
      `Header ASCII: \`${asciiDump}\``,
      ``,
      detected
        ? `*Tipe Asli Terdeteksi:* ${detected.desc}\n` +
          `*Kategori:* ${detected.category}\n` +
          `*Format Umum:* ${detected.ext}`
        : `*Tipe Asli:* Format tidak terdaftar atau merupakan Plain Text / Unknown Binary Data.`,
    ].join("\n");

    return context.reply(out);
  },
};
