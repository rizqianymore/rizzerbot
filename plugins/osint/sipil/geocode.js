import { request } from "@/src/utils/request.js";

export default {
  name: "geocode",
  aliases: ["alamat", "geolokasi", "lokasi", "coordinates", "coord"],
  description:
    "Konversi alamat atau nama tempat menjadi koordinat geolokasi (Latitude & Longitude) dan kirim lokasi pin map",
  usage: "<nama tempat atau alamat lengkap> (contoh: .geocode Monas Jakarta)",
  premiumOnly: false,
  category: "OSINT",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const currentPrefix = prefix || ".";
    const query = args.join(" ").trim();

    if (!query) {
      return reply(
        `*CARA PENGGUNAAN GEOLOKASI:*\n\n` +
          `│ \`${currentPrefix}geocode Monas Jakarta\`\n` +
          `│ \`${currentPrefix}alamat Gedung Sate Bandung\`\n` +
          `│ \`${currentPrefix}lokasi Jl. Malioboro Yogyakarta\``
      );
    }

    try {
      const results = await request.json("https://nominatim.openstreetmap.org/search", {
        params: {
          q: query,
          format: "json",
          limit: 1,
          addressdetails: 1,
        },
        headers: {
          "User-Agent": "RizzerBot/1.0 (WhatsApp Geocoding Utility)",
          "Accept-Language": "id,en;q=0.9",
        },
        timeout: 12000,
      });

      if (!Array.isArray(results) || results.length === 0) {
        return reply(`[FAIL] Alamat/lokasi *"${query}"* tidak ditemukan. Coba ketik nama tempat yang lebih spesifik.`);
      }

      const place = results[0];
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      const addr = place.address || {};

      const mapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
      const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;

      let text = `*OSINT TOOLS - GEOLOKASI KOORDINAT*\n`;
      text += `└─ Alamat Lengkap: ${place.display_name}\n`;
      text += `└─ Latitude     : ${lat}\n`;
      text += `└─ Longitude    : ${lon}\n`;
      text += `└─ Tipe Lokasi  : ${place.type || "-"}\n`;
      text += `└─ Google Maps  : ${mapsLink}\n`;
      text += `└─ OSM Link     : ${osmLink}\n`;
      text += `│\n`;
      return reply(text);
    } catch (err) {
      return reply(`Gagal mencari geolokasi: ${err.response?.data?.message || err.message}`);
    }
  },
};
