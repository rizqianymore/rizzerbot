import { settings } from '@/config/settings.js';
import { db } from '@/src/core/database.js';
import {
  getMediaBuffer,
  createSticker,
  webpToImage,
} from '@/src/services/media.js';
import {
  fetchLyrics,
  translateText,
} from '@/src/services/scrape.js';

import { getUptimeString } from '@/src/utils/helper.js';

export default [
  {
    name: "ping",
    description: "Check bot speed",
    category: "User",
    run: async (sock, msg, args, { reply, senderJid, sendTyping }) => {
      await sendTyping();
      const start = Date.now();
      await sock.sendMessage(msg.key.remoteJid, { text: "⚡ Ping..." }, { quoted: msg });
      const speed = Date.now() - start;
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `⚡ *Pong!*\nKecepatan: *${speed}ms*` },
        { quoted: msg }
      );
    }
  },
  {
    name: "owner",
    aliases: ["ownerinfo", "creator"],
    description: "Get owner info",
    category: "User",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const text =
        `👤 *Owner Info*\n\n` +
        `*Nama:* ${settings.ownerName}\n` +
        `*Nomor:* wa.me/${settings.ownerNumber}\n\n` +
        `Hubungi owner jika ada kendala / ingin upgrade premium.`;
      await reply(text);
    }
  },
  {
    name: "uptime",
    description: "Check how long the bot has been running",
    category: "User",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      await reply(`⏳ *Uptime:* ${getUptimeString()}`);
    }
  },
  {
    name: "quote",
    description: "Get a random rizz quote",
    category: "User",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const quotes = [
        "Are you a magician? Because whenever I look at you, everyone else disappears.",
        "Do you have a map? I keep getting lost in your eyes.",
        "Are you a Wi-Fi signal? Because I'm feeling a really strong connection.",
        "Do you believe in love at first sight, or should I walk by again?",
        "Is your name Google? Because you have everything I've been searching for.",
        "If you were a triangle, you'd be acute one.",
        "Are you a camera? Because every time I look at you, I smile.",
        "We're not socks, but I think we'd make a great pair.",
        "Are you a keyboard? Because you're just my type.",
        "Did it hurt when you fell from the vending machine? Because you're a snack.",
        "Are you a bank loan? Because you have my interest.",
        "If looks could kill, you'd be a lethal weapon.",
        "Are you Netflix? Because I could watch you for hours.",
        "You must be a broom, because you just swept me off my feet.",
        "Are you a star? Because you light up my night sky.",
      ];
      await reply(`💘 _"${quotes[Math.floor(Math.random() * quotes.length)]}"_`);
    }
  },
  {
    name: "sticker",
    aliases: ["s"],
    description: "Convert image/video to sticker",
    category: "User",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
      const target = quoted || msg;
      const buffer = await getMediaBuffer(sock, target);
      if (!buffer) return reply("❌ Balas/buka gambar atau video dengan caption *\\.sticker*");
      try {
        const stickerBuffer = await createSticker(buffer);
        await sock.sendMessage(
          msg.key.remoteJid,
          { sticker: stickerBuffer },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal membuat stiker: ${err.message}`);
      }
    }
  },
  {
    name: "toimg",
    aliases: ["toimage"],
    description: "Convert sticker to image",
    category: "User",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
      let buffer = null;
      if (quoted?.stickerMessage) {
        buffer = await getMediaBuffer(sock, {
          ...msg,
          message: { stickerMessage: quoted.stickerMessage },
        });
      }
      if (!buffer) return reply("❌ Balas stiker dengan caption *\\.toimg*");
      try {
        const png = await webpToImage(buffer);
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: png, caption: "🖼️ *Hasil konversi stiker ke gambar*" },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal mengkonversi: ${err.message}`);
      }
    }
  },
  {
    name: "lyrics",
    aliases: ["lirik"],
    description: "Search song lyrics",
    category: "User",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const query = args.join(" ");
      if (!query) return reply("❌ Masukkan judul lagu! Contoh: *.lyrics [penyanyi] [judul]*");
      const parts = query.split(" ");
      const artist = parts.slice(0, -1).join(" ") || "unknown";
      const title = parts[parts.length - 1];
      await reply("🔍 Mencari lirik...");
      try {
        const lyrics = await fetchLyrics(artist, title);
        await reply(`🎵 *Lirik: ${title}*\n\n${lyrics.slice(0, 3000)}`);
      } catch (err) {
        await reply(`❌ Lirik tidak ditemukan. Pastikan format: *penyair judul*`);
      }
    }
  },
  {
    name: "translate",
    aliases: ["tr"],
    description: "Translate text (default: id)",
    category: "User",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const text = args.join(" ");
      if (!text) return reply("❌ Masukkan teks! Contoh: *.translate hello world*");
      try {
        const result = await translateText(text, "id");
        await reply(`✅ *Terjemahan:*\n\n${result.translated}`);
      } catch (err) {
        await reply(`❌ Terjemahan gagal: ${err.message}`);
      }
    }
  },
  {
    name: "report",
    description: "Report bug to owner",
    category: "User",
    run: async (sock, msg, args, { reply, sendTyping, senderJid }) => {
      await sendTyping();
      const data =
        `📩 *Laporan Masuk*\n\n` +
        `*Dari:* ${msg.pushName || "User"}\n` +
        `*Nomor:* ${senderJid}\n\n` +
        `*Laporan:* ${args.join(" ") || "(kosong)"}`;
      await sock.sendMessage(settings.ownerNumber + "@s.whatsapp.net", { text: data });
      await reply("✅ Laporan telah dikirim ke Owner.");
    }
  },
  {
    name: "profile",
    description: "View your profile & status",
    category: "User",
    run: async (sock, msg, args, { reply, sendTyping, senderJid, isPremium }) => {
      await sendTyping();
      const user = db.getUser(senderJid);
      await reply(
        `👤 *Profil Anda*\n\n` +
        `*Nama:* ${msg.pushName || "User"}\n` +
        `*Nomor:* ${senderJid.split("@")[0]}\n` +
        `*Status:* ${isPremium ? "⭐ Premium" : "Free User"}\n` +
        `*Bio:* ${user.profile || "-"}\n` +
        `*Terdaftar:* ${new Date(user.createdAt).toLocaleDateString("id-ID")}`
      );
    }
  }
];