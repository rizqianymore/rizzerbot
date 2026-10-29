export default {
  name: "polisi",
  aliases: ["fbiwanted", "wanted", "buronan", "fbi"],
  description: "Cari buronan FBI Wanted (most wanted) berdasarkan nama",
  usage: "<nama>, cth: polisi John | polisi Bin Laden",
  premiumOnly: true,
  cooldownMs: 4000,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    const query = (args || []).join(" ").trim();
    const isLatest = !query || /^(today|terbaru|latest)$/i.test(query);

    await sendTyping();
    if (isLatest) {
      await reply(`Memuat buronan FBI Wanted terbaru...`);
    } else {
      await reply(`Mencari buronan FBI Wanted untuk *${query}*...`);
    }

    let data;
    try {
      const { request } = await import("@/src/utils/request.js");
      const url = isLatest
        ? `https://api.fbi.gov/wanted/v1/list?pageSize=5`
        : `https://api.fbi.gov/wanted/v1/list?title=${encodeURIComponent(query)}&pageSize=5`;
      data = await request.json(url, { timeout: 20000 });
    } catch (err) {
      return reply(`Gagal mengakses FBI Wanted: ${err?.message || err}`);
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) {
      return isLatest
        ? reply(`Tidak ada data buronan FBI Wanted.`)
        : reply(`Tidak ada buronan FBI Wanted yang cocok dengan *${query}*.`);
    }

    const lines = [isLatest ? `*FBI WANTED — BURONAN TERBARU*` : `*FBI WANTED — HASIL PENCARIAN*`, ``];

    for (const item of items) {
      const title = item.title || item.uid || "-";
      const reward = item.reward_text || item.reward_min || "-";
      const url = item.url || (item.uid ? `https://www.fbi.gov/wanted/${item.uid}` : "-");
      lines.push(`• *${title}*`);
      if (reward && reward !== "-") lines.push(`   Reward: ${String(reward).slice(0, 120)}`);
      if (url && url !== "-") lines.push(`   ${url}`);
      lines.push("");
    }

    lines.push(`_Sumber: FBI Wanted (api.fbi.gov)_`);
    return reply(lines.join("\n").trim());
  },
};