import {
  getLatestKompasNews,
  searchKompasNews,
  getKompasArticleDetail,
} from "@/src/services/kompastv.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default [
  {
    name: "kompastv",
    aliases: ["kompasnews", "beritakompas", "kompas"],
    description: "Berita terkini, pencarian topik, dan baca berita dari Kompas TV",
    premiumOnly: true,
    category: "News",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();

      const firstArg = args[0]?.trim();

      // Kasus 1: Membaca detail artikel dari link Kompas TV
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
            } catch (_) {}
          }

          return await reply(caption);
        } catch (err) {
          return await reply(`❌ Gagal membaca detail berita: ${err.message}`);
        }
      }

      // Kasus 2: Pencarian berita berdasarkan kata kunci
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
            } catch (_) {}
          }

          return await reply(caption);
        } catch (err) {
          return await reply(`❌ Gagal mencari berita: ${err.message}`);
        }
      }

      // Kasus 3: Menampilkan berita terbaru / headline terkini Kompas TV
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
          } catch (_) {}
        }

        return await reply(caption);
      } catch (err) {
        return await reply(`❌ Gagal mengambil berita terkini: ${err.message}`);
      }
    },
  },
];
