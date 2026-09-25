import { db } from '@/src/core/database.js';
import {
  getMediaBuffer,
  upscaleImage,
  createSticker,
} from '@/src/services/media.js';
import {
  textToSpeech,
  searchAnime,
  webSearch,
  aiChat,
} from '@/src/services/scrape.js';

export default [
  {
    name: "hd",
    description: "Upscale image to HD (2x)",
    premiumOnly: true,
    category: "Premium",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
      const buffer = await getMediaBuffer(sock, quoted || msg);
      if (!buffer) return reply("❌ Balas/buka gambar dengan caption *\\.hd*");
      await reply("✨ Memproses gambar ke HD...");
      try {
        const hdBuffer = await upscaleImage(buffer, 2);
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: hdBuffer, caption: "✨ *Hasil Upscale HD (2x)*" },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal memproses: ${err.message}`);
      }
    }
  },
  {
    name: "tts",
    description: "Text to speech (Google TTS)",
    premiumOnly: true,
    category: "Premium",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const text = args.join(" ");
      if (!text) return reply("❌ Masukkan teks! Contoh: *.tts halo dunia*");
      await reply("🗣️ Mengonversi teks ke suara...");
      try {
        const audio = await textToSpeech(text, "id-ID");
        await sock.sendMessage(
          msg.key.remoteJid,
          { audio, mimetype: "audio/mpeg", ptt: true },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Gagal membuat suara: ${err.message}`);
      }
    }
  },
  {
    name: "nsfw",
    description: "Toggle NSFW content mode in this chat",
    premiumOnly: true,
    groupOnly: true,
    groupAdminOnly: true,
    category: "Premium",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const groupJid = msg.key.remoteJid;
      const action = (args[0] || "").toLowerCase();
      if (action !== "on" && action !== "off") {
        return reply("Gunakan *.nsfw on* atau *.nsfw off*.");
      }

      const enabled = action === "on";
      db.setNsfw(groupJid, enabled);
      await reply(
        enabled
          ? "🔞 *Mode NSFW diaktifkan* untuk chat ini."
          : "✅ *Mode NSFW dimatikan* untuk chat ini."
      );
    }
  },
  {
    name: "stickernowm",
    description: "Create sticker without watermark",
    premiumOnly: true,
    category: "Premium",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
      const buffer = await getMediaBuffer(sock, quoted || msg);
      if (!buffer) return reply("❌ Balas/buka gambar dengan caption *\\.stickernowm*");
      // Parse text meme atas / bawah
      let topText = "";
      let bottomText = "";
      if (args.length > 0) {
        const fullText = args.join(" ");
        if (fullText.includes("|")) {
          const parts = fullText.split("|");
          topText = parts[0]?.trim() || "";
          bottomText = parts.slice(1).join("|")?.trim() || "";
        } else {
          bottomText = fullText.trim();
        }
      }

      try {
        const stickerBuffer = await createSticker(buffer, { pack: "", author: "", topText, bottomText });
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
    name: "aipro",
    description: "AI Chat (GPT/Gemini)",
    premiumOnly: true,
    category: "Premium",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const prompt = args.join(" ");
      if (!prompt) return reply("❌ Masukkan pertanyaan! Contoh: *.aipro apa itu rizz?*");
      await reply("🧠 Menganalisis...");
      try {
        const answer = await aiChat(prompt);
        await reply(`🤖 *AI Answer:*\n\n${answer.slice(0, 3000)}`);
      } catch (err) {
        await reply(`❌ ${err.message}`);
      }
    }
  },
  {
    name: "customprofile",
    aliases: ["setprofile"],
    description: "Set custom profile text",
    premiumOnly: true,
    category: "Premium",
    run: async (sock, msg, args, { reply, sendTyping, senderJid }) => {
      await sendTyping();
      const text = args.join(" ").trim();
      if (!text) return reply("❌ Masukkan teks profil! Contoh: *.customprofile CEO of Rizz*");
      db.updateUser(senderJid, { profile: text });
      await reply(`✅ Profil kustom diatur:\n\n"${text}"`);
    }
  },
  {
    name: "statspro",
    description: "Detailed command statistics",
    premiumOnly: true,
    category: "Premium",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const usage = db.data.usage || {};
      const total = Object.values(usage).reduce((a, b) => a + b, 0);
      const top = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 10);
      let text =
        `📊 *Statistik Penggunaan Bot*\n\n` +
        `*Total Perintah:* ${total}\n` +
        `*Jumlah Fitur:* ${Object.keys(usage).length}\n\n` +
        `*Top 10 Command:*\n`;
      top.forEach(([cmd, count], i) => {
        text += ` ${i + 1}. ${cmd}: ${count}x\n`;
      });
      await reply(text);
    }
  },
  {
    name: "searchpro",
    description: "Deep web search",
    premiumOnly: true,
    category: "Premium",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const query = args.join(" ");
      if (!query) return reply("❌ Masukkan kata kunci! Contoh: *.searchpro rizz bot*");
      await reply("🔍 Mencari...");
      try {
        const results = await webSearch(query);
        const text =
          results
            .map((r, i) => `${i + 1}. *${r.text}*\n${r.url || ""}`)
            .join("\n\n");
        await reply(`🔎 *Hasil Pencarian:*\n\n${text.slice(0, 3000)}`);
      } catch (err) {
        await reply(`❌ Gagal mencari: ${err.message}`);
      }
    }
  },
  {
    name: "animepro",
    description: "Search anime info (Jikan API)",
    premiumOnly: true,
    category: "Premium",
    run: async (sock, msg, args, { reply, sendTyping }) => {
      await sendTyping();
      const query = args.join(" ");
      if (!query) return reply("❌ Masukkan judul anime! Contoh: *.animepro naruto*");
      await reply("⛩️ Mencari anime...");
      try {
        const anime = await searchAnime(query);
        const text =
          `⛩️ *${anime.title}*\n\n` +
          `*Judul JP:* ${anime.titleJp || "-"}\n` +
          `*Tipe:* ${anime.type || "-"}\n` +
          `*Episode:* ${anime.episodes ?? "-"}\n` +
          `*Status:* ${anime.status}\n` +
          `*Skor:* ⭐ ${anime.score || "-"}\n` +
          `*Genre:* ${anime.genres}\n\n` +
          `📖 ${anime.synopsis || "-"}`;
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: { url: anime.image }, caption: text },
          { quoted: msg }
        );
      } catch (err) {
        await reply(`❌ Anime tidak ditemukan.`);
      }
    }
  }
];