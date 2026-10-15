import { getMediaBuffer, createSticker, findDownloadableTarget } from "@/src/services/fetch/media.js";

export default {
  name: "sticker",
  aliases: ["s", "stiker", "stikermeme", "smeme", "stikerteks"],
  description: "Convert image/video to sticker (support meme teks atas | bawah)",
  usage: "[--font=Nama --size=48 --wrap=4 --tengah/--atas/--bawah --justify] [teks atas | bawah] (reply/kirim gambar atau video)",
  category: "Sticker",
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();

    const targetMsg = findDownloadableTarget(msg);

    if (!targetMsg) {
      return reply(
        "Kirim atau balas gambar/video/GIF/stiker dengan caption:\n" +
          "• *.sticker* — ubah jadi stiker (video/GIF tetap bergerak)\n" +
          "• *.sticker Teks Atas | Teks Bawah* — stiker meme (bisa gambar & video)\n" +
          "• 1 teks saja otomatis di bawah, pakai --tengah / --atas buat pindah\n" +
          "• Flag: *--font=Nama --size=48 --tengah/--atas/--bawah --justify*\n" +
          "  Contoh: *.sticker --size=64 --tengah Halo | Dunia*"
      );
    }

    let buffer = null;
    try {
      buffer = await getMediaBuffer(sock, targetMsg);
    } catch (err) {
      return reply(`${err?.message || "Gagal membaca media."}`);
    }
    if (!buffer)
      return reply(
        "Gagal membaca media. Pastikan mengirim atau membalas media berupa gambar, video, GIF, atau stiker."
      );

    let font = "";
    let fontSize = 0;
    let wordsPerLine = 0;
    let position = "";
    let align = "center";
    const textArgs = [];
    for (const a of args) {
      const low = String(a || "").toLowerCase();
      if (low.startsWith("--font=")) {
        font = String(a).slice(7).trim();
        continue;
      }
      if (low.startsWith("--size=")) {
        const n = Number(String(a).slice(7));
        if (Number.isFinite(n) && n >= 12 && n <= 200) fontSize = Math.floor(n);
        continue;
      }
      if (low.startsWith("--wrap=")) {
        const n = Number(String(a).slice(7));
        if (Number.isFinite(n) && n >= 1 && n <= 10) wordsPerLine = Math.floor(n);
        continue;
      }
      if (low === "--tengah" || low === "--middle" || low === "--center") {
        position = "tengah";
        continue;
      }
      if (low === "--atas" || low === "--top") {
        position = "atas";
        continue;
      }
      if (low === "--bawah" || low === "--bottom") {
        position = "bawah";
        continue;
      }
      if (low === "--justify" || low === "--rata") {
        align = "justify";
        continue;
      }
      textArgs.push(a);
    }

    let topText = "";
    let bottomText = "";
    if (textArgs.length > 0) {
      const fullText = textArgs.join(" ");
      if (fullText.includes("|")) {
        const parts = fullText.split("|");
        topText = parts[0]?.trim() || "";
        bottomText = parts.slice(1).join("|")?.trim() || "";
      } else {
        bottomText = fullText.trim();
      }
    }

    try {
      const stickerBuffer = await createSticker(buffer, { topText, bottomText, font, fontSize, wordsPerLine, position, align });
      await sock.sendMessage(msg.key.remoteJid, { sticker: stickerBuffer, mimetype: "image/webp" }, { quoted: msg });
    } catch (err) {
      await reply(`Gagal membuat stiker: ${err.message}`);
    }
  },
};
