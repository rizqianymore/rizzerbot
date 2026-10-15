import axios from "axios";

export default {
  name: "geocode",
  aliases: ["alamat", "geolokasi", "lokasi", "coordinates", "coord"],
  description: "Konversi alamat atau nama tempat menjadi koordinat geolokasi (Latitude & Longitude) dan kirim lokasi pin map",
  usage: "<nama tempat atau alamat lengkap> (contoh: .geocode Monas Jakarta)",
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const currentPrefix = prefix || ".";
    const query = args.join(" ").trim();

    if (!query) {
      return reply(
        `*CARA PENGGUNAAN GEOLOKASI:*\n\n` +
          `• \`${currentPrefix}geocode Monas Jakarta\`\n` +
          `• \`${currentPrefix}alamat Gedung Sate Bandung\`\n` +
          `• \`${currentPrefix}lokasi Jl. Malioboro Yogyakarta\``
      );
    }

    try {
      const res = await axios.get("https://nominatim.openstreetmap.org/search", {
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

      const results = res.data;
      if (!Array.isArray(results) || results.length === 0) {
        return reply(`❌ Alamat/lokasi *"${query}"* tidak ditemukan. Coba ketik nama tempat yang lebih spesifik.`);
      }

      const place = results[0];
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      const addr = place.address || {};

      const mapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
      const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;

      const text =
        `*📍 HASIL PENCARIAN GEOLOKASI*\n\n` +
        `• *Nama / Tempat* : ${place.name || place.display_name.split(",")[0] || "-"}\n` +
        `• *Alamat Lengkap*: ${place.display_name}\n` +
        `• *Latitude*       : \`${lat}\`\n` +
        `• *Longitude*      : \`${lon}\`\n` +
        `• *Kecamatan/Kota* : ${addr.suburb || addr.city_district || addr.city || "-"}\n` +
        `• *Provinsi*       : ${addr.state || addr.province || addr.region || "-"}\n` +
        `• *Kode Pos*       : ${addr.postcode || "-"}\n` +
        `• *Negara*         : ${addr.country || "-"}\n\n` +
        `🔗 *Google Maps*   : ${mapsLink}\n` +
        `🌐 *OpenStreetMap* : ${osmLink}`;

      // Coba kirimkan WhatsApp native interactive location pin jika sock mendukung
      if (sock && msg?.key?.remoteJid) {
        try {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              location: {
                degreesLatitude: lat,
                degreesLongitude: lon,
                name: place.name || query,
                address: place.display_name,
              },
            },
            { quoted: msg }
          );
        } catch (_) {}
      }

      return reply(text);
    } catch (err) {
      return reply(`Gagal mencari geolokasi: ${err.response?.data?.message || err.message}`);
    }
  },
};
