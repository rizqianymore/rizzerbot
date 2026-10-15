import axios from "axios";

const WMO = {
  0: "Cerah",
  1: "Cerah berawan",
  2: "Berawan",
  3: "Mendung",
  45: "Berkabut",
  48: "Kabut es",
  51: "Gerimis ringan",
  53: "Gerimis",
  55: "Gerimis lebat",
  61: "Hujan ringan",
  63: "Hujan",
  65: "Hujan lebat",
  80: "Hujan lokal ringan",
  81: "Hujan lokal",
  82: "Hujan lokal lebat",
  95: "Badai petir",
  96: "Badai petir + es",
  99: "Badai petir + es",
};

function wmoText(code) {
  if (Object.hasOwn(WMO, code)) return WMO[code];
  if (code >= 71 && code <= 77) return "Salju";
  return "Berawan";
}

export default {
  name: "cuaca",
  aliases: ["weather", "infocuaca"],
  description: "Cuaca terkini kota Indonesia",
  usage: "<kota>",
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const city = args.join(" ").trim() || "Jakarta";
    await sendTyping();
    let geo = null;
    try {
      const g = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
        params: { name: city, count: 1, language: "id", format: "json" },
        timeout: 15000,
      });
      geo = g?.data?.results?.[0] || null;
    } catch (err) {
      return reply(`Gagal mencari kota ${city}: ${err?.message || "network error"}`);
    }
    if (!geo) return reply(`Kota *${city}* tidak ditemukan. Coba: ${prefix || "."}cuaca Surabaya`);
    let cur = null;
    try {
      const w = await axios.get("https://api.open-meteo.com/v1/forecast", {
        params: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
          timezone: "auto",
        },
        timeout: 15000,
      });
      cur = w?.data?.current || null;
    } catch (err) {
      return reply(`Gagal memuat cuaca ${geo.name}: ${err?.message || "network error"}`);
    }
    if (!cur) return reply(`Data cuaca ${geo.name} kosong, coba lagi nanti.`);
    return reply(
      `*CUACA — ${(geo.name || city).toUpperCase()}*\n` +
        `${geo.admin1 || ""}${geo.country ? `, ${geo.country}` : ""}\n\n` +
        `• Kondisi : ${wmoText(cur.weather_code)}\n` +
        `• Suhu : ${cur.temperature_2m}°C\n` +
        `• Kelembapan : ${cur.relative_humidity_2m}%\n` +
        `• Angin : ${cur.wind_speed_10m} km/jam\n\n` +
        `_Sumber: Open-Meteo_`
    );
  },
};
