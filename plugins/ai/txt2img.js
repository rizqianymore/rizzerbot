// plugins/ai/txt2imgv2.js — perintah "txt2img" (generate gambar dari teks, TANPA API key).
// Backend: Pollinations AI gratis (image.pollinations.ai) — pengganti JereAPI yang sudah tidak ada.
// Flag --style dipertahankan, diterjemahkan jadi penegas prompt (backend gratis tidak punya param style).
import { fetchBuffer } from "@/src/services/scrape.js";

const STYLE_PROMPTS = {
  cinematic: "cinematic lighting, dramatic, film still, highly detailed",
  "painted-anime": "painted anime style, vibrant, detailed anime illustration",
  "digital-painting": "digital painting, smooth brush strokes, artstation quality",
  "concept-art": "concept art, epic composition, highly detailed environment",
  cyberpunk: "cyberpunk style, neon lights, futuristic city, high tech",
  "3d-render": "3d render, octane render, soft studio lighting, ultra detailed",
  "casual-photo": "casual amateur photo, natural lighting, realistic",
  "traditional-japanese": "traditional japanese art style, ukiyo-e inspired",
  none: "",
};

export default {
  name: "txt2img",
  aliases: ["txt2imgv2", "text2img", "gambarai"],
  description: "Generate gambar dari teks (gratis, tanpa API key)",
  usage: "<prompt> [--style <nama_style>]",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const raw = args.join(" ").trim();
    if (!raw) {
      return reply(
        `*TEXT TO IMAGE*\n\n` +
        `Penggunaan: *${prefix}txt2img <prompt> [--style <nama_style>]*\n` +
        `Contoh: *${prefix}txt2img kucing astronot di luar angkasa*\n\n` +
        `Style: ${Object.keys(STYLE_PROMPTS).join(", ")}`
      );
    }

    let style = "cinematic";
    let promptText = raw;
    if (raw.includes("--style")) {
      const parts = raw.split("--style");
      promptText = parts[0].trim();
      style = (parts[1].trim().split(/\s+/)[0] || "cinematic").toLowerCase();
      if (!STYLE_PROMPTS[style]) style = "cinematic";
    }
    if (!promptText) return reply("❌ Masukkan prompt gambar!");

    const react = (emoji) =>
      sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});
    await react("🎨");
    await reply(`Menggambar "${promptText.slice(0, 100)}" (style: ${style})...`);

    try {
      const styleSuffix = STYLE_PROMPTS[style] ? `, ${STYLE_PROMPTS[style]}` : "";
      const fullPrompt = `${promptText}${styleSuffix}`;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&nologo=true&model=flux`;
      const imgBuffer = await fetchBuffer(url);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: imgBuffer,
          caption: `*TEXT TO IMAGE*\nPrompt: ${promptText.slice(0, 200)}\nStyle: ${style}`,
        },
        { quoted: msg }
      );
      await react("✅");
    } catch (err) {
      await react("❌");
      await reply(`*TEXT TO IMAGE GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
