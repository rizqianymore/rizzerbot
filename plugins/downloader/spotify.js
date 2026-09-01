import axios from "axios";
import { fetchBuffer } from "@/src/utils/scraping.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SPOTY_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://spotyloader.com/",
  Origin: "https://spotyloader.com",
};

export async function downloadSpotifyTrack(spotifyUrl) {
  if (!spotifyUrl || !spotifyUrl.includes("spotify.com")) {
    throw new Error("Tautan Spotify tidak valid.");
  }

  
  const postRes = await axios.post(
    "https://spotyloader.com/api/spotify/track",
    { url: spotifyUrl },
    { headers: SPOTY_HEADERS, timeout: 20000 }
  );

  const initialData = postRes.data;

  
  if (initialData.downloadLink && initialData.post) {
    return {
      title: initialData.post.name || "Spotify Track",
      artist: initialData.post.artist || "Unknown Artist",
      album: initialData.post.album || "-",
      image: initialData.post.image || null,
      downloadLink: initialData.downloadLink,
      durationMs: initialData.post.duration_ms || 0,
    };
  }

  if (!initialData.jobId) {
    throw new Error("Gagal membuat antrean unduhan Spotify.");
  }

  
  const jobId = initialData.jobId;
  const maxAttempts = 15;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await delay(2000);

    const statusRes = await axios.get(
      `https://spotyloader.com/api/spotify/track/status/${jobId}`,
      { headers: SPOTY_HEADERS, timeout: 15000 }
    );

    const statusData = statusRes.data;

    if (
      (statusData.status === "ready" || statusData.status === "completed") &&
      statusData.downloadLink
    ) {
      return {
        title: statusData.post?.name || "Spotify Track",
        artist: statusData.post?.artist || "Unknown Artist",
        album: statusData.post?.album || "-",
        image: statusData.post?.image || null,
        downloadLink: statusData.downloadLink,
        durationMs: statusData.post?.duration_ms || 0,
      };
    }

    if (statusData.status === "failed") {
      throw new Error("Server gagal mengonversi lagu Spotify ini.");
    }
  }

  throw new Error("Proses pengunduhan Spotify timeout (antrean penuh).");
}

export default {
  name: "spotify",
  aliases: ["spoty", "spotdl", "spotifydl"],
  description: "Mengunduh lagu dari Spotify menjadi audio MP3 berkualitas tinggi.",
  usage: "<link Spotify track>",
  example: "spotify https://open.spotify.com/track/1XabvPK1VQEH4YqzDovs46",
  category: "Downloader",
  premiumOnly: true,
  cooldown: 5000,
  run: async (sock, msg, args, context) => {
    const { sendTyping } = context;
    const url = args[0];

    if (!url) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ *Harap sertakan link lagu Spotify!*\n\nContoh:\n`.spotify https:
        },
        { quoted: msg }
      );
      return;
    }

    if (!/open\.spotify\.com\/track\//i.test(url)) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "❌ Link harus berupa URL Spotify Track (contoh: https://open.spotify.com/track/...)." },
        { quoted: msg }
      );
      return;
    }

    await sendTyping();

    const loadingMsg = await sock.sendMessage(
      msg.key.remoteJid,
      { text: "⏳ Sedang memproses dan mengunduh lagu dari Spotify..." },
      { quoted: msg }
    );

    try {
      const track = await downloadSpotifyTrack(url);

      await sock.sendMessage(msg.key.remoteJid, {
        text: `📥 Mengunduh audio: *${track.title}* - *${track.artist}*...`,
        edit: loadingMsg.key,
      });

      const audioBuffer = await fetchBuffer(track.downloadLink);

      let coverBuffer = null;
      if (track.image) {
        try {
          coverBuffer = await fetchBuffer(track.image);
        } catch (_) {}
      }

      const captionText =
        `🎵 *Spotify Track Downloader*\n\n` +
        `├─ 🏷️ *Judul:* ${track.title}\n` +
        `├─ 👤 *Artis:* ${track.artist}\n` +
        `├─ 💿 *Album:* ${track.album}\n` +
        `└─ ⏱️ *Durasi:* ${Math.floor(track.durationMs / 60000)}m ${Math.floor((track.durationMs % 60000) / 1000)}s\n\n` +
        `⚡ _Audio MP3 berkualitas tinggi_`;

      if (coverBuffer) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: coverBuffer,
            caption: captionText,
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          audio: audioBuffer,
          mimetype: "audio/mp4",
          fileName: `${track.artist} - ${track.title}.mp3`,
          ptt: false,
          contextInfo: {
            externalAdReply: {
              title: track.title,
              body: track.artist,
              mediaType: 1,
              renderLargerThumbnail: false,
              thumbnail: coverBuffer || undefined,
              sourceUrl: url,
            },
          },
        },
        { quoted: msg }
      );

      await sock.sendMessage(msg.key.remoteJid, {
        text: "✅ Selesai mengunduh lagu Spotify!",
        edit: loadingMsg.key,
      });
    } catch (err) {
      console.error("[Spotify Error]", err.message);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Gagal mengunduh lagu Spotify: ${err.message}`,
        edit: loadingMsg.key,
      });
    }
  },
};
