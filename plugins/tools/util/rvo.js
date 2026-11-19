import { downloadContentFromMessage } from "baileys";
import { ensureVideoCompatible } from "../../../src/services/fetch/downloaderCompat.js";

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

export default {
  name: "rvo",
  aliases: ["readviewonce", "viewonce"],
  description: "Membuka dan mendownload media sekali lihat (view once)",
  usage: "(reply media view once)",
  ownerOnly: true,
  category: "Tools",
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping, quoted }) => {
    await sendTyping();

    if (!quoted) {
      return reply("Balas (reply) pesan View Once (foto, video, atau voice note) dengan perintah *.rvo*");
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
      return reply("Pesan yang dibalas bukan media View Once atau media gambar/video/audio.");
    }

    try {
      if (imageMsg) {
        const stream = await downloadContentFromMessage(imageMsg, "image");
        const buffer = await streamToBuffer(stream);

        let caption = `┌── MEDIA SEKALI LIHAT (FOTO)\n` + `│ Tipe: Foto\n` + `└──`;
        if (imageMsg.caption) {
          caption += `\n\nKeterangan: ${imageMsg.caption}`;
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
        const rawBuffer = await streamToBuffer(stream);
        const buffer = await ensureVideoCompatible(rawBuffer);

        let caption = `┌── MEDIA SEKALI LIHAT (VIDEO)\n` + `│ Tipe: Video\n` + `└──`;
        if (videoMsg.caption) {
          caption += `\n\nKeterangan: ${videoMsg.caption}`;
        }

        await sock.sendMessage(
          msg.key.remoteJid,
          {
            video: buffer,
            caption,
            mimetype: "video/mp4",
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
      await reply(`Gagal membuka View Once: ${err.message}`);
    }
  },
};
