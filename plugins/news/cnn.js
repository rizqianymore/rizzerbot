import { searchCNNNews, getCnnLatestNews, getCnnArticle } from "@/src/services/news/cnn.js";
import { runNewsCommand } from "@/src/services/news/runner.js";

export default {
  name: "cnn",
  aliases: ["cnnnews", "beritacnn"],
  description: "Berita CNN: terkini, pencarian topik, dan baca artikel",
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
        command: "cnn",
        label: "CNN",
        latestTitle: "BERITA TERKINI CNN",
        latestSubtitle: "Sumber: edition.cnn.com",
        readingText: "Mengambil isi lengkap artikel CNN...",
        errorLabel: "Gagal mengambil berita CNN",
        latest: async ({ limit }) => (await getCnnLatestNews(limit)).items,
        search: async ({ query, limit, page }) => (await searchCNNNews(query, { size: limit, page })).items,
        article: getCnnArticle,
      },
    }),
};
