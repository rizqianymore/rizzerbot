import { generateTTSAudio } from "@/src/services/aiVisionVoice.js";

export default {
  name: "tts",
  aliases: ["sound", "vn", "suara", "speech"],
  description: "Mengonversi teks menjadi pesan audio suara (Voice Note AI).",
  usage: "[kode_bahasa] <teks>",
  example: "tts id Halo selamat pagi semuanya!",
  category: "AI",
  premiumOnly: true,
  cooldown: 3000,
  run: async (sock, msg, args, { sendTyping, activePrefix }) => {
    let lang = "id";
    let text = args.join(" ").trim();

    // Deteksi jika argumen pertama adalah kode bahasa (contoh: id, en, ja, ar)
    if (args.length > 1 && args[0].length === 2) {
      lang = args[0].toLowerCase();
      text = args.slice(1).join(" ").trim();
    }

    if (!text) {
      return await sock.sendMessage(
        msg.key.remoteJid,
        {
          text:
            `🗣️ *AI Text-to-Speech (Voice Note)*\n\n` +
            `*Format:* \`${activePrefix}tts [kode_bahasa] <teks>\`\n` +
            `*Contoh:* \`${activePrefix}tts Halo semuanya, bot ini sedang aktif!\`\n` +
            `*Contoh Bahasa Inggris:* \`${activePrefix}tts en Good morning everyone!\``,
        },
        { quoted: msg }
      );
    }

    await sendTyping();

    try {
      const audioBuffer = await generateTTSAudio(text, lang);

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          audio: audioBuffer,
          mimetype: "audio/mp4",
          ptt: true, // Kirim sebagai Voice Note (Push-to-Talk)
        },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ Gagal menghasilkan suara: ${err.message}` },
        { quoted: msg }
      );
    }
  },
};
