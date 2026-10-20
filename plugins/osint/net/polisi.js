function lastMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default {
  name: "crimeuk",
  aliases: ["ukpolice", "kejahatanuk", "policestats"],
  description: "Data kejahatan UK Police (street-level crime) berdasarkan koordinat",
  usage: "<lat> <lng> [YYYY-MM], cth: polisi 52.6297 -1.1316 2024-01",
  premiumOnly: true,
  cooldownMs: 5000,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const lat = Number(args?.[0]);
    const lng = Number(args?.[1]);
    const date = (args?.[2] || lastMonth()).trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return reply(
        `*UK POLICE CRIME DATA*\n\n` +
          `• \`${currentPrefix}polisi 52.6297 -1.1316\`\n` +
          `• \`${currentPrefix}polisi 52.6297 -1.1316 2024-01\`\n\n` +
          `Koordinat latitude/longitude (Inggris).`
      );
    }
    if (!/^\d{4}-\d{2}$/.test(date)) {
      return reply(`Format tanggal tidak valid. Gunakan YYYY-MM.`);
    }

    await sendTyping();
    await reply(`Memuat data kejahatan UK Police untuk ${lat}, ${lng} (${date})...`);

    let data;
    try {
      const { request } = await import("@/src/utils/request.js");
      data = await request.json(
        `https://data.police.uk/api/crimes-street/all-crime?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&date=${encodeURIComponent(date)}`,
        { timeout: 20000 }
      );
    } catch (err) {
      return reply(`Gagal memuat data polisi: ${err?.message || err}`);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return reply(`Tidak ada data kejahatan untuk lokasi/tanggal tersebut.`);
    }

    const counts = {};
    for (const item of data) {
      const cat = item.category || "unknown";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    const lines = [
      `*UK POLICE — STREET CRIME*`,
      ``,
      `• Koordinat: ${lat}, ${lng}`,
      `• Periode: ${date}`,
      `• Total insiden: ${data.length}`,
      ``,
      `*Kategori (top 10):*`,
    ];

    for (const [cat, n] of sorted.slice(0, 10)) {
      lines.push(`   • ${cat.replace(/-/g, " ")}: ${n}`);
    }

    lines.push(``, `_Sumber: data.police.uk (UK Police)_`);
    return reply(lines.join("\n"));
  },
};