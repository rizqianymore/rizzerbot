import { getLatestKompasNews, searchKompasNews, getKompasArticleDetail } from "@/src/services/news/kompastv.js";
import { runNewsCommand } from "@/src/services/news/runner.js";

export default {
  name: "kompastv",
  aliases: ["kompasnews", "beritakompas", "kompas"],
  description: "Berita Kompas TV: terkini, pencarian topik, dan baca artikel",
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
        command: "kompas",
        label: "Kompas TV",
        latestTitle: "BERITA TERKINI KOMPAS TV",
        latestSubtitle: "Pembaruan langsung dari kompas.tv/news",
        readingText: "Mengambil isi lengkap berita Kompas TV...",
        errorLabel: "Gagal mengambil berita Kompas TV",
        latest: async ({ limit, offset }) => (await getLatestKompasNews("news", limit + offset)).slice(offset),
        search: async ({ query, limit, offset }) => (await searchKompasNews(query, limit + offset)).slice(offset),
        article: getKompasArticleDetail,
      },
    }),
};
