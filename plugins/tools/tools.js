import { downloadContentFromMessage } from "baileys";

/**
 * Downloads a media stream into a single Buffer.
 */
async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

export default [
  {
    name: "rvo",
    aliases: ["readviewonce", "viewonce"],
    description: "Membuka dan mendownload media sekali lihat (view once)",
    category: "Tools",
    run: async (sock, msg, args, { reply, sendTyping, quoted }) => {
      await sendTyping();

      if (!quoted) {
        return reply("❌ Balas (reply) pesan View Once (foto, video, atau voice note) dengan perintah *.rvo*!");
      }

      // Unwrap View Once container jika dibungkus viewOnceMessage / viewOnceMessageV2
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
];
