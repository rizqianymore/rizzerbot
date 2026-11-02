import axios from "axios";
import { createTtlCache } from "@/src/utils/ttl-cache.js";
const sholatCache = createTtlCache({ ttlMs: 60 * 60 * 1000, max: 100 });

export default {
  name: "sholat",
  aliases: ["jadwalsholat", "sholatjadwal"],
  description: "Jadwal sholat kota Indonesia (Kemenag RI)",
  usage: "<kota>",
  category: "Tools",
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const city = args.join(" ").trim() || "Jakarta";
    const key = city.toLowerCase();
    let data = sholatCache.get(key);
    if (!data) {
      await sendTyping();
      try {
        const res = await axios.get("https://api.aladhan.com/v1/timingsByCity", {
          params: { city, country: "Indonesia", method: 20 },
          timeout: 15000,
        });
        data = res?.data?.data || null;
        if (data?.timings) sholatCache.set(key, data);
      } catch (err) {
        return reply(`Gagal memuat jadwal sholat ${city}: ${err?.message || "network error"}`);
      }
    }
    if (!data?.timings) return reply(`Jadwal sholat untuk *${city}* tidak ditemukan.`);
    const t = data.timings;
    const hijri = data?.date?.hijri
      ? `${data.date.hijri.day} ${data.date.hijri.month?.en || ""} ${data.date.hijri.year} H`
      : "";
    const greg = data?.date?.readable || "";
    return reply(
      `*JADWAL SHOLAT — ${city.toUpperCase()}*\n` +
        `${greg}${hijri ? ` (${hijri})` : ""}\n\n` +
        `• Imsak : ${t.Imsak}\n` +
        `• Subuh : ${t.Fajr}\n` +
        `• Terbit : ${t.Sunrise}\n` +
        `• Dzuhur : ${t.Dhuhr}\n` +
        `• Ashar : ${t.Asr}\n` +
        `• Maghrib : ${t.Maghrib}\n` +
        `• Isya : ${t.Isha}\n\n` +
        `_Sumber: Kemenag RI via Aladhan. Ganti kota: ${prefix || "."}sholat Bandung_`
    );
  },
};
