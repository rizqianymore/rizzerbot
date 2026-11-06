import { request } from "@/src/utils/request.js";

/**
 * Upload text/code to public pastebins (Zero API Key needed)
 * Primary: katbin / dpaste / paste.rs
 */
async function uploadPaste(content) {
  // 1. Katbin
  try {
    const res = await request.json("https://katb.in/api/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paste: { content } }),
      timeout: 10000,
    });
    if (res?.id) {
      return `https://katb.in/${res.id}`;
    }
  } catch (_) {}

  // 2. dpaste
  try {
    const res = await request.text("https://dpaste.com/api/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `content=${encodeURIComponent(content)}&expiry_days=7`,
      timeout: 10000,
    });
    const url = (res || "").trim();
    if (url.startsWith("http")) {
      return url;
    }
  } catch (_) {}

  // 3. paste.rs
  try {
    const res = await request.text("https://paste.rs", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: content,
      timeout: 10000,
    });
    const url = (res || "").trim();
    if (url.startsWith("http")) {
      return url;
    }
  } catch (_) {}

  throw new Error("Gagal mengunggah ke semua server pastebin publik.");
}

export default {
  name: "paste",
  aliases: ["pastebin", "hastebin", "katbin", "dpaste"],
  description: "Unggah teks panjang atau kode ke pastebin publik dan dapatkan tautan singkat",
  usage: "<teks / reply teks panjang>",
  category: "Tools",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const p = prefix || ".";

    // Cek apakah ada reply pesan teks
    const quotedText =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      "";

    const content = (args.join(" ") || quotedText).trim();

    if (!content) {
      return reply(
        `*PASTEBIN UPLOADER*\n\n` +
          `Format:\n` +
          `• *${p}paste <teks atau script>*\n` +
          `• Atau balas (reply) pesan panjang dengan *${p}paste*\n\n` +
          `Contoh:\n` +
          `• *${p}paste console.log("Hello world");*`
      );
    }

    if (content.length < 5) {
      return reply("Teks terlalu pendek untuk diunggah ke pastebin.");
    }

    await reply("Sedang mengunggah teks ke pastebin...");

    try {
      const url = await uploadPaste(content);
      const lines = content.split("\n").length;
      const chars = content.length;

      return reply(
        `*PASTEBIN BERHASIL!*\n\n` +
          `• *URL:* ${url}\n` +
          `• *Panjang:* ${chars} karakter (${lines} baris)\n` +
          `• *Status:* Publik & Siap Dibagikan`
      );
    } catch (err) {
      return reply(`*GAGAL UPLOAD*\n${err?.message || "Terjadi kesalahan koneksi."}`);
    }
  },
};
