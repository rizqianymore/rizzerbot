import { createTtlCache } from "@/src/utils/ttl-cache.js";
const cuacaCache = createTtlCache({ ttlMs: 30 * 60 * 1000, max: 100 });

const CITY_PRESETS = {
  jakarta: "31.71.01.1001",
  bandung: "32.73.01.1001",
  surabaya: "35.78.01.1001",
  semarang: "33.74.01.1001",
  medan: "12.71.01.1001",
  makassar: "73.71.01.1001",
  denpasar: "51.71.01.1001",
  yogyakarta: "34.71.01.1001",
  palembang: "16.71.01.1001",
  pekanbaru: "14.71.01.1001",
  balikpapan: "64.71.01.1001",
  manado: "71.71.01.1001",
  padang: "13.71.01.1001",
  malang: "35.73.04.1001",
  bogor: "32.71.02.1001",
  bekasi: "32.75.03.1001",
  tangerang: "36.71.02.1001",
  batam: "21.71.01.1001",
  bandarlampung: "18.71.01.1001",
  banjarmasin: "63.71.01.1001",
};

export default {
  name: "cuaca",
  aliases: ["weather", "prakiraan", "bmkgcuaca", "infocuaca"],
  description: "Prakiraan cuaca BMKG (kota preset atau kode adm4)",
  usage: "[kota|kode adm4], cth: cuaca jakarta | cuaca 31.71.01.1001",
  premiumOnly: false,
  cooldownMs: 3000,
  category: "Tools",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const input = (args || []).join(" ").trim().toLowerCase();
    const adm4 = CITY_PRESETS[input] || (args || []).join(" ").trim();

    if (!adm4) {
      return reply(
        `┌── PRAKIRAAN CUACA BMKG\n` +
          `│ Format: ${currentPrefix}cuaca <kota / kode adm4>\n` +
          `│ Preset: ${Object.keys(CITY_PRESETS).slice(0, 10).join(", ")}\n` +
          `└─\n\n` +
          `Contoh: ${currentPrefix}cuaca jakarta`
      );
    }

    const cacheKey = adm4.toLowerCase();
    let data = cuacaCache.get(cacheKey);
    if (!data) {
      await sendTyping();
      await reply(`Memuat prakiraan cuaca untuk *${adm4}*...`);
      try {
        const res = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        cuacaCache.set(cacheKey, data);
      } catch (err) {
        return reply(`Gagal memuat cuaca: ${err?.message || err}`);
      }
    }

    const lokasi = data?.lokasi || {};
    const cuacaList = data?.data?.[0]?.cuaca?.[0] || [];
    if (!cuacaList.length) return reply("Data cuaca kosong dari BMKG.");

    const fmtTime = (s) => (s || "").replace("T", " ").replace("Z", " UTC").slice(0, 16);
    const lines = [
      `┌── CUACA ${lokasi.kotkab || "-"}, ${lokasi.provinsi || "-"}\n` +
        `│ Kecamatan: ${lokasi.kecamatan || "-"}\n` +
        `│ Sumber: BMKG Indonesia\n` +
        `└─\n`,
      `┌── PRAKIRAAN`,
    ];

    for (const c of cuacaList.slice(0, 5)) {
      lines.push(`│ ${fmtTime(c.local_datetime)}: ${c.weather_desc || "-"} (${c.t}°C, RH ${c.hu}%)`);
    }
    lines.push(`└─`);
    return reply(lines.join("\n"));
  },
};
