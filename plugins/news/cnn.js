import { searchCNNNews } from "@/src/services/cnn.js";
import { fetchBuffer } from "@/src/services/scrape.js";

export default [
  {
    name: "cnn",
    aliases: ["cnnnews", "beritacnn"],
    description: "Cari berita internasional terkini dari CNN",
    premiumOnly: false,
    category: "News",
    run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
      await sendTyping();

      const query = args.join(" ").trim();
      if (!query) {
        return reply(
          `🌐 *Panduan Penggunaan Berita CNN*\n\n` +
          `• *.cnn [topik/kata kunci]*\n  _Mencari berita terkini dari CNN (Internasional)_\n\n` +
          `💡 *Contoh:*\n` +
          `*.cnn indonesia*\n` +
          `*.cnn technology*\n` +
          `*.cnn palestine*`
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
          } catch (_) {}
        }

        await reply(caption);
      } catch (err) {
        await reply(`❌ Gagal mengambil berita CNN: ${err.message}`);
      }
    },
  },
];
