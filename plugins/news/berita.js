import { getRssLatest, searchRssFeed, dedupeNews, RSS_SOURCES } from "@/src/services/news/rss.js";
import { searchGoogleNews } from "@/src/services/news/googlenews.js";
import { readNewsArticle } from "@/src/services/news/generic.js";
import { runNewsCommand } from "@/src/services/news/runner.js";

const SOURCE_NAMES = RSS_SOURCES.map((source) => source.name).join(", ");

export default {
  name: "berita",
  aliases: ["news", "terkini", "beritaterkini"],
  description: "Agregator berita nasional dari banyak sumber sekaligus",
  usage: "[topik] [jumlah] / [halaman N] / [link artikel]",
  premiumOnly: true,
  category: "News",
  run: async (sock, msg, args, ctx) =>
    runNewsCommand({
      sock,
      msg,
      args,
      ctx,
      config: {
        command: "berita",
        label: "Agregator Berita",
        latestTitle: "BERITA TERKINI HARI INI",
        latestSubtitle: `Sumber: ${SOURCE_NAMES}`,
        readingText: "📖 Mengambil isi lengkap artikel...",
        errorLabel: "Gagal mengambil berita",
        latest: async ({ limit, offset }) => {
          const items = (await getRssLatest({ limit: limit + offset })).slice(offset);
          if (!items.length) throw new Error("Semua sumber RSS tidak merespons. Coba lagi beberapa saat lagi.");
          return items;
        },
        search: async ({ query, limit, offset }) => {
          const need = limit + offset;
          let items = await searchRssFeed({ query, limit: need });

          if (items.length < need) {
            try {
              const remote = await searchGoogleNews({ query, limit: need });
              items = dedupeNews([...items, ...remote]);
            } catch (_) {}
          }

          return items.slice(offset);
        },
        article: readNewsArticle,
      },
    }),
};
