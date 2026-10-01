// plugins/ai/text2speech.js — perintah "text2speech" (TTS gratis via Google, TANPA API key).
// Pengganti versi lama yang butuh JereAPI (global.web) yang sudah tidak ada.
// Catatan: "tts" premium sudah ada di plugins/premium/tts.js, jadi alias "tts" sengaja TIDAK dipakai di sini.
import { textToSpeech } from "@/src/services/scrape.js";

export default {
  name: "text2speech",
  aliases: ["aitts", "speak", "ttsfree"],
  description: "Ubah teks jadi pesan suara (gratis, tanpa API key)",
  usage: "<teks> | [lang: id/en]",
  premiumOnly: false,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const raw = args.join(" ").trim();
    if (!raw) {
      return reply(
        `*TEXT TO SPEECH*\n\n` +
        `Penggunaan: *${prefix}text2speech <teks> | [id/en]*\n` +
        `Contoh: *${prefix}text2speech Halo, apa kabar?*`
      );
    }

    let [teks, lang] = raw.split("|").map((s) => s?.trim());
    if (!teks) return reply("❌ Masukkan teks yang mau diubah jadi suara!");
    lang = (lang || "id").toLowerCase().startsWith("en") ? "en" : "id-ID";
    if (teks.length > 200) teks = teks.slice(0, 200);

    const react = (emoji) =>
      sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});
    await react("🕕");

    try {
      const audio = await textToSpeech(teks, lang);
      await sock.sendMessage(
        msg.key.remoteJid,
        { audio, mimetype: "audio/mpeg", ptt: true },
        { quoted: msg }
      );
      await react("✅");
    } catch (err) {
      await react("❌");
      await reply(`*TEXT TO SPEECH GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
