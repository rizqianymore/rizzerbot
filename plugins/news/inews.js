import { searchInews, getInewsArticle } from "@/src/services/inews.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default [
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
          `*.inews timnas indonesia*\n` +
          `*.inews https://www.inews.id/news/nasional/...*`
        );
      }

      // Kasus 1: Membaca artikel dari link URL iNews.id
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
            } catch (_) {}
          }

          return await reply(caption);
        } catch (err) {
          return await reply(`❌ Gagal membaca detail artikel: ${err.message}`);
        }
      }

      // Kasus 2: Mencari berita berdasarkan topik
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
          } catch (_) {}
        }

        await reply(caption);
      } catch (err) {
        await reply(`❌ Gagal mengambil berita iNews: ${err.message}`);
      }
    },
  },
];
