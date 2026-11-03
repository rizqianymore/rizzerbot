import { request } from "@/src/utils/request.js";

function getQuotedText(quoted) {
  if (!quoted || typeof quoted !== "object") return "";
  if (typeof quoted === "string") return quoted;
  if (quoted.conversation) return String(quoted.conversation);
  if (quoted.extendedTextMessage?.text) return String(quoted.extendedTextMessage.text);
  if (quoted.imageMessage?.caption) return String(quoted.imageMessage.caption);
  if (quoted.videoMessage?.caption) return String(quoted.videoMessage.caption);
  if (quoted.documentMessage?.caption) return String(quoted.documentMessage.caption);
  if (quoted.viewOnceMessage?.message) return getQuotedText(quoted.viewOnceMessage.message);
  if (quoted.viewOnceMessageV2?.message) return getQuotedText(quoted.viewOnceMessageV2.message);
  if (quoted.viewOnceMessageV2Extension?.message) return getQuotedText(quoted.viewOnceMessageV2Extension.message);
  // fallback scan values
  for (const v of Object.values(quoted)) {
    if (v && typeof v === "object" && (v.text || v.caption || v.conversation)) {
      if (v.text) return String(v.text);
      if (v.caption) return String(v.caption);
      if (v.conversation) return String(v.conversation);
    }
  }
  return "";
}

function chunkText(text, size = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    // try not to cut in the middle of a word if possible
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastSpace = slice.lastIndexOf(" ");
      const lastDot = slice.lastIndexOf(".");
      const cut = Math.max(lastSpace, lastDot);
      if (cut > size * 0.6) end = start + cut + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
    // skip leading spaces for next chunk
    while (text[start] === " ") start++;
  }
  return chunks;
}

export default {
  name: "speak",
  aliases: ["say", "googletts", "ttsfree"],
  description: "Text to Speech Google gratis (id/en/jp dll) — free",
  usage: "[lang] <teks> | reply teks",
  category: "Tools",
  cooldownMs: 5000,
  run: async (sock, msg, args, { reply, sendTyping, prefix, quoted }) => {
    const cur = prefix || ".";

    // parse lang
    let lang = "id";
    let textParts = [...(args || [])];
    if (textParts.length > 0) {
      const candRaw = String(textParts[0] || "").trim();
      // lang pattern: 2 chars or 2-2 with dash/underscore (e.g. en, id, ja, ko, ar, en-US, jp)
      const isLangCode = /^[a-z]{2}(?:[-_][a-z]{2})?$/i.test(candRaw) && candRaw.length <= 5;
      if (isLangCode) {
        lang = candRaw.toLowerCase();
        // normalize jp -> ja, underscore -> dash
        if (lang === "jp") lang = "ja";
        lang = lang.replace("_", "-");
        // keep dash case for BCP-47: en-us -> en-US not needed, google accepts lower
        textParts = textParts.slice(1);
      }
    }

    let text = textParts.join(" ").trim();

    if (!text) {
      // try quoted from context (provided by execute.js)
      let qText = getQuotedText(quoted);
      if (!qText) {
        // fallback directly from msg
        const ctxQuoted =
          msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
          msg.message?.imageMessage?.contextInfo?.quotedMessage ||
          msg.message?.videoMessage?.contextInfo?.quotedMessage ||
          msg.message?.documentMessage?.contextInfo?.quotedMessage ||
          null;
        // also scan universal
        if (ctxQuoted) qText = getQuotedText(ctxQuoted);
        else {
          // last resort: scan any contextInfo
          for (const v of Object.values(msg.message || {})) {
            if (v?.contextInfo?.quotedMessage) {
              qText = getQuotedText(v.contextInfo.quotedMessage);
              if (qText) break;
            }
          }
        }
      }
      text = String(qText || "").trim();
    }

    if (!text) {
      return reply(
        `*TTS GOOGLE*\n\n` +
          `Ubah teks jadi audio (Google Translate TTS).\n\n` +
          `*Cara pakai:*\n` +
          `• \`${cur}tts halo dunia\` (default lang id)\n` +
          `• \`${cur}tts en hello world\`\n` +
          `• \`${cur}tts ja こんにちは\`\n` +
          `• Reply pesan teks lalu \`${cur}tts id\` atau \`${cur}tts\`\n\n` +
          `*Lang:* id, en, en-US, ja/jp, ko, ar, zh, fr, de, dll (kode Google TTS)\n` +
          `Maks 200 karakter per chunk, otomatis split jika panjang.`
      );
    }

    if (text.length > 1000) {
      text = text.slice(0, 1000);
    }

    await sendTyping?.();

    const chunks = chunkText(text, 200);
    if (!chunks.length) return reply("Teks kosong.");

    // limit chunks to prevent abuse (max 5 chunks = 1000 chars)
    const limited = chunks.slice(0, 5);

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://translate.google.com/",
      Accept: "*/*",
    };

    try {
      const buffers = [];
      for (const chunk of limited) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
        let buf = null;
        try {
          buf = await request.buffer(url, { headers, timeout: 15000 });
        } catch (_) {
          // fallback to native fetch
          const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ab = await res.arrayBuffer();
          buf = Buffer.from(ab);
        }
        if (!buf || !buf.length) throw new Error("Audio kosong dari Google TTS");
        buffers.push(buf);
      }

      const audioBuffer = buffers.length === 1 ? buffers[0] : Buffer.concat(buffers);

      if (!audioBuffer?.length) return reply("Gagal ambil audio TTS.");

      await sock.sendMessage(
        msg.key.remoteJid,
        { audio: audioBuffer, mimetype: "audio/mpeg", ptt: false },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal TTS: ${err?.message || err}`);
    }
  },
};
