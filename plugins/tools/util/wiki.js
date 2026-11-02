import { request } from "@/src/utils/request.js";

export default {
  name: "wiki",
  aliases: ["wikipedia", "wikisearch", "cariwiki"],
  description: "Cari ringkasan Wikipedia Indonesia",
  usage: "<query>, cth: wiki Soekarno",
  category: "Tools",
  cooldownMs: 4000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const cur = prefix || ".";
    const q = args.join(" ").trim();
    if (!q) return reply(`Masukkan kata kunci!\nContoh: \`${cur}wiki Jakarta\``);
    await sendTyping();
    try {

      const search = await request.json(
        `https://id.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=1&namespace=0&format=json`,
        { timeout: 12000 }
      );
      const title = Array.isArray(search) && Array.isArray(search[1]) ? search[1][0] : null;
      const target = title || q;
      const sum = await request.json(
        `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(target)}`,
        { timeout: 12000 }
      );
      if (sum?.type === "disambiguation" || sum?.extract) {
        const lines = [
          `*WIKIPEDIA: ${sum.title || target}*`,
          "",
          sum.extract ? sum.extract.slice(0, 900) : "Tidak ada ringkasan.",
        ];
        if (sum.content_urls?.desktop?.page) lines.push("", `Link: ${sum.content_urls.desktop.page}`);
        return reply(lines.join("\n"));
      }
      if (sum?.title) {
        return reply(`*WIKIPEDIA: ${sum.title}*\n${sum.extract || "Tidak ada ringkasan."}`);
      }
      return reply("Tidak ditemukan di Wikipedia.");
    } catch (err) {
      return reply(`Gagal cari wiki: ${err?.message || err}`);
    }
  },
};
