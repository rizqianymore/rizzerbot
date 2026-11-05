import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { extractExifMetadata } from "@/src/services/forensic/exif.js";

export default {
  name: "exif",
  aliases: ["metadata", "readexif", "fotoinfo"],
  description: "Forensik metadata gambar (kamera, tanggal, lensa, GPS maps)",
  usage: "(reply foto asli)",
  category: "OSINT",
  cooldownMs: 5000,
  run: async (sock, msg, _args, context) => {
    const target = findDownloadableTarget(msg);
    if (!target) {
      return context.reply("Kirim atau reply foto yang ingin dianalisis metadata forensiknya.");
    }

    await context.sendTyping();

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 15 * 1024 * 1024 });
    } catch (err) {
      return context.reply(`Gagal mengunduh file media: ${err.message}`);
    }

    if (!buffer || buffer.length === 0) {
      return context.reply("File gambar kosong.");
    }

    const exifData = extractExifMetadata(buffer);
    if (!exifData || (!exifData.rawTags || Object.keys(exifData.rawTags).length === 0)) {
      return context.reply(
        "Tidak ada metadata EXIF yang ditemukan.\n\n" +
        "Tip: WhatsApp otomatis menghapus metadata EXIF jika dikirim sebagai 'Gambar'. " +
        "Minta pengirim mengirimkan foto sebagai 'Dokumen' (*Send as Document*) untuk forensik penuh."
      );
    }

    const lines = [
      "*IMAGE EXIF FORENSIC ANALYSIS*",
      `Ukuran File : ${(buffer.length / 1024).toFixed(2)} KB`,
      "",
      "*Perangkat / Kamera:*",
      `  - Brand    : ${exifData.camera.make}`,
      `  - Model    : ${exifData.camera.model}`,
      `  - Lensa    : ${exifData.camera.lens}`,
      `  - Software : ${exifData.camera.software}`,
      "",
      "*Pengambilan Foto:*",
      `  - Waktu    : ${exifData.capture.dateTime}`,
      `  - ISO      : ${exifData.capture.iso}`,
      `  - Aperture : ${exifData.capture.fNumber}`,
      `  - Shutter  : ${exifData.capture.exposureTime}`,
      `  - Focal    : ${exifData.capture.focalLength}`,
    ];

    if (exifData.gps) {
      lines.push(
        "",
        "*Koordinat Lokasi (GPS):*",
        `  - Latitude  : ${exifData.gps.latitude.toFixed(6)}`,
        `  - Longitude : ${exifData.gps.longitude.toFixed(6)}`,
        `  - Google Maps: ${exifData.gps.mapsUrl}`
      );
    } else {
      lines.push("", "*Koordinat GPS:* Tidak disertakan dalam EXIF");
    }

    return context.reply(lines.join("\n"));
  },
};
