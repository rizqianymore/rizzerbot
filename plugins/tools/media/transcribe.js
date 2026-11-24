import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { smartTranscribe } from "@/src/services/fetch/transcribe.js";

export default {
  name: "transcribe",
  aliases: ["stt", "voicetotext", "vntotext", "notulen", "transkrip"],
  description: "Transkripsi pesan suara (VN) atau file audio menjadi teks menggunakan AI Whisper / Gemini",
  usage: "[reply VN/audio]",
  category: "Tools",
  premiumOnly: true,
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const p = prefix || ".";
    const target = findDownloadableTarget(msg);

    if (!target) {
      return reply(
        `*VOICE TO TEXT / NOTULEN OTOMATIS*\n\n` +
          `Reply pesan suara (Voice Note / Audio) lalu ketik:\n` +
          `│ \`${p}transcribe\`\n` +
          `│ \`${p}notulen\`\n\n` +
          `Bot akan mendengarkan dan mengubah suara pembicara menjadi teks rapi secara otomatis.`
      );
    }

    const mime = String(target.mimetype || "").toLowerCase();
    if (!mime.includes("audio") && !mime.includes("ogg") && !mime.includes("mp4") && !mime.includes("mpeg")) {
      return reply("Pesan yang di-reply harus berupa pesan suara (VN) atau berkas audio.");
    }

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 25 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal membaca audio: ${err?.message || err}`);
    }

    if (!buffer?.length) {
      return reply("File audio kosong atau gagal diunduh.");
    }

    await reply("Mendengarkan dan mentranskripsikan suara...");

    const ext = mime.includes("ogg") ? "ogg" : "mp3";
    const filename = `voice-${Date.now()}.${ext}`;

    try {
      const res = await smartTranscribe(buffer, {
        filename,
        mimeType: target.mimetype || "audio/mp3",
        lang: args[0] || "id",
      });

      if (!res.text) {
        return reply("Tidak ada suara atau percakapan yang dapat didengar secara jelas.");
      }

      let text = `*HASIL TRANSKRIPSI SUARA (STT)*\n\n`;
      text += `"${res.text}"\n\n`;
      text += `└─ _Mesin: ${res.source}${res.duration ? ` • Durasi: ${Math.round(res.duration)}s` : ""}_`;

      return reply(text);
    } catch (err) {
      return reply(err.message || "Gagal mentranskripsikan audio.");
    }
  },
};
