import { downloadContentFromMessage } from "baileys";
import { getStockTicker } from "@/src/services/stock.js";

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

export default [
  // --- VIEW ONCE UNLOCKER ---
  {
    name: "rvo",
    aliases: ["readviewonce", "viewonce"],
    description: "Membuka dan mendownload media sekali lihat (view once)",
    premiumOnly: true,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping, quoted }) => {
      await sendTyping();

      if (!quoted) {
        return reply("❌ Balas (reply) pesan View Once (foto, video, atau voice note) dengan perintah *.rvo*!");
      }

      const inner =
        quoted.viewOnceMessage?.message ||
        quoted.viewOnceMessageV2?.message ||
        quoted.viewOnceMessageV2Extension?.message ||
        quoted;

      const imageMsg = inner.imageMessage;
      const videoMsg = inner.videoMessage;
      const audioMsg = inner.audioMessage;

      if (!imageMsg && !videoMsg && !audioMsg) {
        return reply("❌ Pesan yang dibalas bukan media View Once atau media gambar/video/audio!");
      }

      await reply("🔓 Membuka media sekali lihat...");

      try {
        if (imageMsg) {
          const stream = await downloadContentFromMessage(imageMsg, "image");
          const buffer = await streamToBuffer(stream);

          let caption = "🔓 *View Once Image Unlocked*";
          if (imageMsg.caption) {
            caption += `\n\n*Caption Asli:* ${imageMsg.caption}`;
          }

          await sock.sendMessage(
            msg.key.remoteJid,
            {
              image: buffer,
              caption,
              mimetype: imageMsg.mimetype || "image/jpeg",
            },
            { quoted: msg }
          );
        } else if (videoMsg) {
          const stream = await downloadContentFromMessage(videoMsg, "video");
          const buffer = await streamToBuffer(stream);

          let caption = "🔓 *View Once Video Unlocked*";
          if (videoMsg.caption) {
            caption += `\n\n*Caption Asli:* ${videoMsg.caption}`;
          }

          await sock.sendMessage(
            msg.key.remoteJid,
            {
              video: buffer,
              caption,
              mimetype: videoMsg.mimetype || "video/mp4",
            },
            { quoted: msg }
          );
        } else if (audioMsg) {
          const stream = await downloadContentFromMessage(audioMsg, "audio");
          const buffer = await streamToBuffer(stream);

          await sock.sendMessage(
            msg.key.remoteJid,
            {
              audio: buffer,
              mimetype: audioMsg.mimetype || "audio/ogg; codecs=opus",
              ptt: Boolean(audioMsg.ptt),
            },
            { quoted: msg }
          );
        }
      } catch (err) {
        await reply(`❌ Gagal membuka View Once: ${err.message}`);
      }
    },
  },

  // --- BLOOMBERG / SAHAM / TICKER ---
  {
    name: "bloombergstock",
    aliases: ["bloomberg", "stock", "saham", "ticker", "bbg"],
    description: "Pantau harga saham, komoditas emas/minyak, dan crypto secara realtime",
    premiumOnly: false,
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();

      const input = args.join(" ").trim();
      if (!input) {
        return reply("Contoh: *.bloombergstock GC1:COM* atau *.saham BBCA*");
      }

      try {
        const data = await getStockTicker(input);

        const isPositive = data.priceChange >= 0;
        const trend = isPositive ? "▲" : "▼";
        const sign = isPositive ? "+" : "";

        const formattedPrice =
          typeof data.price === "number"
            ? data.price.toLocaleString("id-ID", { maximumFractionDigits: 2 })
            : data.price;

        const formattedChange =
          typeof data.priceChange === "number"
            ? `${sign}${data.priceChange.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`
            : data.priceChange;

        const formattedPercent =
          typeof data.percentChange === "number"
            ? `${sign}${data.percentChange.toFixed(2)}%`
            : data.percentChange;

        const output =
          `📊 *${data.name}* (\`${data.symbol || data.id}\`)\n` +
          `💰 *${formattedPrice} ${data.currency}*\n` +
          `📈 ${trend} ${formattedChange} (${formattedPercent})`;

        await reply(output);
      } catch (err) {
        await reply(`❌ Gagal: ${err.message}`);
      }
    },
  },
];
