export default {
  name: "polisi",
  aliases: ["fbiwanted", "wanted", "buronan", "fbi"],
  description: "Cari buronan FBI Wanted (most wanted) berdasarkan nama",
  usage: "<nama>, cth: polisi John | polisi Bin Laden",
  premiumOnly: true,
  cooldownMs: 4000,
  category: "OSINT",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const query = (args || []).join(" ").trim();
    if (!query) {
      return reply(`Masukkan nama buronan!\nContoh: \`${currentPrefix}polisi John\``);
    }

    await sendTyping();
    await reply(`Mencari buronan FBI Wanted untuk *${query}*...`);

    let data;
    try {
      const { request } = await import("@/src/utils/request.js");
      data = await request.json(
        `https://api.fbi.gov/wanted/v1/list?title=${encodeURIComponent(query)}&pageSize=5`,
        { timeout: 20000 }
      );
    } catch (err) {
      return reply(`Gagal mengakses FBI Wanted: ${err?.message || err}`);
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) {
      return reply(`Tidak ada buronan FBI Wanted yang cocok dengan *${query}*.`);
    }

    const lines = [`*FBI WANTED — BURONAN*`, ``];

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