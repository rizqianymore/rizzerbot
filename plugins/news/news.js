import { searchCNNNews } from "@/src/services/cnn.js";
import { searchInews, getInewsArticle } from "@/src/services/inews.js";
import {
  getLatestKompasNews,
  searchKompasNews,
  getKompasArticleDetail,
} from "@/src/services/kompastv.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default [
  {
    name: "cnn",
    aliases: ["cnnnews", "beritacnn"],
    description: "Cari berita internasional terkini dari CNN",
    premiumOnly: false,
    category: "News",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();

      const query = args.join(" ").trim();
      if (!query) {
        return reply(
          `🌐 *Panduan Penggunaan Berita CNN*\n\n` +
          `• *.cnn [topik/kata kunci]*\n  _Mencari berita terkini dari CNN (Internasional)_\n\n` +
          `💡 *Contoh:*\n` +
          `*.cnn indonesia*\n` +
          `*.cnn technology*`
        );
      }

      await reply(`🔍 Mencari berita CNN terkait *"${query}"*...`);

      try {
        const { total, items } = await searchCNNNews(query, { size: 5 });

        if (!items || items.length === 0) {
          return reply(`❌ Tidak ditemukan berita dengan topik *"${query}"* di CNN.`);
        }

        const lines = [
          `🌐 *CNN International News Search*`,
          `_Topik: "${query}" | Ditemukan: ${total} berita_`,
          "",
        ];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          lines.push(`*${i + 1}. ${item.title}*`);
          if (item.date) lines.push(`   _🕒 ${item.date}_`);
          if (item.snippet) lines.push(`   ${item.snippet}`);
          if (item.url) lines.push(`   • Link: ${item.url}`);
          lines.push("");
        }

        lines.push(`💡 _Berita bersumber langsung dari CNN (edition.cnn.com)_`);

        const caption = lines.join("\n").trim();
        const firstThumbnail = items.find((it) => it.thumbnail)?.thumbnail;

        if (firstThumbnail) {
          try {
            const imgBuffer = await fetchBuffer(firstThumbnail, { redirect: "follow" });
            return await sock.sendMessage(
              msg.key.remoteJid,
              { image: imgBuffer, caption },
              { quoted: msg }
            );
          } catch (_) { }
        }

        await reply(caption);
      } catch (err) {
        await reply(`❌ Gagal mengambil berita CNN: ${err.message}`);
      }
    },
  },

  // --- INEWS ---
  {
    name: "inews",
    aliases: ["inewsnews", "beritainews"],
    description: "Cari berita dan baca artikel terkini dari portal iNews.id",
    premiumOnly: false,
    category: "News",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();

      const input = args.join(" ").trim();
      if (!input) {
        return reply(
          `📰 *Panduan Berita iNews.id*\n\n` +
          `• *.inews [kata kunci/topik]*\n  _Mencari berita terkini di iNews.id_\n\n` +
          `• *.inews [link artikel]*\n  _Membaca isi lengkap berita iNews.id_\n\n` +
          `💡 *Contoh:*\n` +
          `*.inews cyber*\n` +
          `*.inews https://www.inews.id/news/nasional/...*`
        );
      }

      // Membaca artikel dari link URL iNews.id
      if (input.startsWith("http://") || input.startsWith("https://")) {
        if (!input.includes("inews.id/")) {
          return reply("❌ Tautan harus berasal dari situs resmi iNews.id!");
        }

        await reply("📖 Mengambil isi lengkap berita iNews.id...");

        try {
          const detail = await getInewsArticle(input);
          const lines = [
            `📰 *${detail.title}*`,
            `─────────────────────────`,
            detail.content,
            `─────────────────────────`,
            `🔗 *Tautan:* ${detail.url}`,
          ];

          const caption = lines.join("\n").trim();

          if (detail.image) {
            try {
              const imgBuffer = await fetchBuffer(detail.image, { redirect: "follow" });
              return await sock.sendMessage(
                msg.key.remoteJid,
                { image: imgBuffer, caption },
                { quoted: msg }
              );
            } catch (_) { }
          }

          return await reply(caption);
        } catch (err) {
          return await reply(`❌ Gagal membaca detail artikel: ${err.message}`);
        }
      }

      // Mencari berita berdasarkan topik
      await reply(`🔍 Mencari berita di iNews.id dengan topik *"${input}"*...`);

      try {
        const results = await searchInews(input, 5);

        if (!results || results.length === 0) {
          return reply(`❌ Tidak ditemukan berita dengan topik *"${input}"* di iNews.id.`);
        }

        const lines = [
          `📰 *HASIL PENCARIAN iNews.id*`,
          `_Topik: "${input}"_`,
          `─────────────────────────`,
        ];

        for (let i = 0; i < results.length; i++) {
          const item = results[i];
          const time = item.time ? `_(${item.time})_` : "";
          lines.push(`*${i + 1}. [${item.category}] ${item.title}* ${time}`);
          lines.push(`   • Link: ${item.url}`);
          lines.push("");
        }

        lines.push(`💡 _Ketik \`${prefix}inews <link>\` untuk membaca isi lengkap artikel._`);

        const caption = lines.join("\n").trim();
        const firstImg = results.find((r) => r.image)?.image;

        if (firstImg) {
          try {
            const imgBuffer = await fetchBuffer(firstImg, { redirect: "follow" });
            return await sock.sendMessage(
              msg.key.remoteJid,
              { image: imgBuffer, caption },
              { quoted: msg }
            );
          } catch (_) { }
        }

        await reply(caption);
      } catch (err) {
        await reply(`❌ Gagal mengambil berita iNews: ${err.message}`);
      }
    },
  },

  // --- KOMPAS TV ---
  {
    name: "kompastv",
    aliases: ["kompasnews", "beritakompas", "kompas"],
    description: "Berita terkini, pencarian topik, dan baca berita dari Kompas TV",
    premiumOnly: false,
    category: "News",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();

      const firstArg = args[0]?.trim();

      // Membaca detail artikel dari link Kompas TV
      if (firstArg && (firstArg.startsWith("http://") || firstArg.startsWith("https://"))) {
        if (!firstArg.includes("kompas.tv/")) {
          return reply("❌ Tautan harus berasal dari situs resmi Kompas TV (kompas.tv)!");
        }

        await reply("📖 Mengambil isi lengkap berita Kompas TV...");

        try {
          const detail = await getKompasArticleDetail(firstArg);
          const lines = [
            `*${detail.title}*`,
            detail.time ? `_🕒 ${detail.time}_` : "",
            detail.author ? `_✍️ ${detail.author}_` : "",
            "",
            detail.content,
            "",
            `🔗 *Tautan Berita:* ${detail.url}`,
          ].filter(Boolean);

          const caption = lines.join("\n").trim();

          if (detail.image) {
            try {
              const img = await fetchBuffer(detail.image, { redirect: "follow" });
              return await sock.sendMessage(
                msg.key.remoteJid,
                { image: img, caption },
                { quoted: msg }
              );
            } catch (_) { }
          }

          return await reply(caption);
        } catch (err) {
          return await reply(`❌ Gagal membaca detail berita: ${err.message}`);
        }
      }

      // Pencarian berita berdasarkan kata kunci
      if (firstArg && isNaN(parseInt(firstArg, 10))) {
        const query = args.join(" ").trim();
        await reply(`🔍 Mencari berita dengan topik "${query}" di Kompas TV...`);

        try {
          const results = await searchKompasNews(query, 5);

          if (!Array.isArray(results) || results.length === 0) {
            return await reply(`Tidak ditemukan berita dengan kata kunci "${query}" di Kompas TV.`);
          }

          const lines = [
            `*Hasil Pencarian Berita Kompas TV*`,
            `_Kata Kunci: "${query}"_`,
            "",
          ];

          for (let i = 0; i < results.length; i++) {
            const item = results[i];
            lines.push(`*${i + 1}. ${item.title}*`);
            if (item.snippet) lines.push(`   ${item.snippet}`);
            lines.push(`   • Link: ${item.url}`);
            lines.push("");
          }

          lines.push(`💡 _Ketik \`${prefix}kompas <link>\` untuk membaca isi lengkap artikel._`);

          const caption = lines.join("\n").trim();
          const firstImage = results.find((r) => r.image)?.image;

          if (firstImage) {
            try {
              const img = await fetchBuffer(firstImage, { redirect: "follow" });
              return await sock.sendMessage(
                msg.key.remoteJid,
                { image: img, caption },
                { quoted: msg }
              );
            } catch (_) { }
          }

          return await reply(caption);
        } catch (err) {
          return await reply(`❌ Gagal mencari berita: ${err.message}`);
        }
      }

      // Menampilkan berita terbaru / headline terkini Kompas TV
      const limit = parseInt(firstArg, 10) || 5;
      await reply("📰 Memuat rangkuman berita terkini dari Kompas TV...");

      try {
        const newsList = await getLatestKompasNews("news", limit);

        if (!Array.isArray(newsList) || newsList.length === 0) {
          return await reply("Belum ada berita terbaru yang dapat dimuat saat ini.");
        }

        const lines = [
          `*Berita Terkini Kompas TV*`,
          `_Pembaruan Langsung dari kompas.tv/news_`,
          "",
        ];

        for (let i = 0; i < newsList.length; i++) {
          const item = newsList[i];
          lines.push(`*${i + 1}. ${item.title}*`);
          lines.push(`   • Waktu: ${item.time}`);
          lines.push(`   • Link: ${item.url}`);
          lines.push("");
        }

        lines.push(`💡 _Ketik \`${prefix}kompas <topik>\` untuk mencari atau \`${prefix}kompas <link>\` untuk baca detail._`);

        const caption = lines.join("\n").trim();
        const topImage = newsList[0]?.image;

        if (topImage) {
          try {
            const img = await fetchBuffer(topImage, { redirect: "follow" });
            return await sock.sendMessage(
              msg.key.remoteJid,
              { image: img, caption },
              { quoted: msg }
            );
          } catch (_) { }
        }

        return await reply(caption);
      } catch (err) {
        await reply(`❌ Gagal mengambil berita terkini: ${err.message}`);
      }
    },
  },
];
