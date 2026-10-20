const CITY_PRESETS = {
  jakarta: "31.71.01.1001",
  bandung: "32.73.01.1001",
  surabaya: "35.78.01.1001",
  semarang: "33.74.01.1001",
  medan: "12.71.01.1001",
  makassar: "73.71.01.1001",
  denpasar: "51.71.01.1001",
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
        `*PRAKIRAAN CUACA BMKG*\n\n` +
          `Kota preset: ${Object.keys(CITY_PRESETS).join(", ")}\n` +
          `Atau gunakan kode adm4: \`${currentPrefix}cuaca 31.71.01.1001\``
      );
    }

    await sendTyping();
    await reply(`Memuat prakiraan cuaca untuk *${adm4}*...`);

    let data;
    try {
      const res = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      return reply(`Gagal memuat cuaca: ${err?.message || err}`);
    }

    const lokasi = data?.lokasi || {};
    const cuacaList = data?.data?.[0]?.cuaca?.[0] || [];
    if (!cuacaList.length) return reply("Data cuaca kosong dari BMKG.");

    const fmtTime = (s) => (s || "").replace("T", " ").replace("Z", " UTC").slice(0, 16);
    const lines = [
      `*PRAKIRAAN CUACA — BMKG*`,
      ``,
      `• Wilayah: ${lokasi.kotkab || "-"}, ${lokasi.kecamatan || "-"}`,
      `• Provinsi: ${lokasi.provinsi || "-"}`,
      ``,
      `*Prakiraan:*`,
    ];

    for (const c of cuacaList.slice(0, 6)) {
      lines.push(
        `• ${fmtTime(c.local_datetime)} — ${c.weather_desc || "-"} (${c.t}°C, RH ${c.hu}%, angin ${c.ws} m/s ${c.wd})`
      );
    }

    lines.push(``, `_Sumber: BMKG_`);
    return reply(lines.join("\n"));
  },
};