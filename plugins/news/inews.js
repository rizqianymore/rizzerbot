import { searchInews, getLatestInews, getInewsArticle } from "@/src/services/news/inews.js";
import { runNewsCommand } from "@/src/services/news/runner.js";

export default {
  name: "inews",
  aliases: ["inewsnews", "beritainews"],
  description: "Berita iNews.id: terkini, pencarian topik, dan baca artikel",
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
        command: "inews",
        label: "iNews.id",
        latestTitle: "BERITA TERKINI iNews.id",
        latestSubtitle: "Sumber: inews.id",
        readingText: "📖 Mengambil isi lengkap berita iNews.id...",
        errorLabel: "Gagal mengambil berita iNews",
        latest: async ({ limit, offset }) => (await getLatestInews(limit + offset)).slice(offset),
        search: async ({ query, limit, offset }) => (await searchInews(query, limit + offset)).slice(offset),
        article: getInewsArticle,
      },
    }),
};
